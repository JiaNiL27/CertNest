import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Read helpers. They take the caller's client, so RLS limits every query to
// the signed-in user's own rows.

export type SortOption = "newest" | "oldest" | "title";
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title (A–Z)" },
];

type SummaryFields = {
  id: string;
  title: string;
  issuer_name: string;
  issued_at: string | null;
  created_at: string;
  credential_url: string | null;
  expiration_status: "has_date" | "never" | "unknown";
  expires_at: string | null;
};

export type CertificateSummary = SummaryFields & {
  skills: string[];
  badgeFileId: string | null;
};

type FileRow = { id: string; kind: string; created_at: string };
type SummaryRow = SummaryFields & {
  certificate_skills: { skills: { name: string } | null }[];
  certificate_files: FileRow[];
};

const SUMMARY_COLUMNS =
  "id, title, issuer_name, issued_at, created_at, credential_url, expiration_status, expires_at, certificate_skills(skills(name)), certificate_files(id, kind, created_at)";

function latestFileId(files: FileRow[], kind: string) {
  return (
    files
      .filter((f) => f.kind === kind)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.id ?? null
  );
}

function toSummary({ certificate_skills, certificate_files, ...row }: SummaryRow): CertificateSummary {
  return {
    ...row,
    skills: certificate_skills
      .map((cs) => cs.skills?.name)
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b)),
    badgeFileId: latestFileId(certificate_files, "badge_image"),
  };
}

// Escape LIKE wildcards so user input is matched literally.
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listCertificates(
  supabase: SupabaseClient,
  opts: { q?: string; issuer?: string; sort?: SortOption; limit?: number } = {},
) {
  let query = supabase.from("certificates").select(SUMMARY_COLUMNS);

  const q = opts.q?.trim().slice(0, 200);
  if (q) query = query.ilike("title", `%${escapeLike(q)}%`);
  if (opts.issuer) query = query.eq("issuer_name", opts.issuer);

  switch (opts.sort ?? "newest") {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "title":
      query = query.order("title", { ascending: true }).order("created_at", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as SummaryRow[]).map(toSummary);
}

export async function listIssuers(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("certificates").select("issuer_name");
  if (error) throw error;
  return [...new Set(data.map((r) => r.issuer_name as string))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export type CertificateFile = {
  id: string;
  kind: "original" | "badge_image";
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

export type CertificateDetail = {
  id: string;
  title: string;
  issuer_name: string;
  source_platform: string | null;
  description: string | null;
  credential_id: string | null;
  credential_url: string | null;
  issued_at: string | null;
  expiration_status: "has_date" | "never" | "unknown";
  expires_at: string | null;
  hidden_from_portfolio: boolean;
  skills: string[];
  original: CertificateFile | null;
  badge: CertificateFile | null;
};

/** Returns null when missing or not owned (callers respond with 404). */
export async function getCertificate(
  supabase: SupabaseClient,
  id: string,
): Promise<CertificateDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await supabase
    .from("certificates")
    .select(
      "id, title, issuer_name, source_platform, description, credential_id, credential_url, issued_at, expiration_status, expires_at, hidden_from_portfolio, certificate_skills(skills(name)), certificate_files(id, kind, file_name, mime_type, file_size, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { certificate_skills, certificate_files, ...rest } = data as unknown as Omit<
    CertificateDetail,
    "skills" | "original" | "badge"
  > & {
    certificate_skills: { skills: { name: string } | null }[];
    certificate_files: CertificateFile[];
  };
  const latest = (kind: CertificateFile["kind"]) =>
    certificate_files
      .filter((f) => f.kind === kind)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  return {
    ...rest,
    skills: certificate_skills.map((cs) => cs.skills?.name).filter((n): n is string => !!n),
    original: latest("original"),
    badge: latest("badge_image"),
  };
}

export async function getDashboardData(supabase: SupabaseClient, userId: string) {
  const [profile, certCount, recent, skillLinks] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("certificates").select("id", { count: "exact", head: true }),
    listCertificates(supabase, { sort: "newest", limit: 8 }),
    supabase.from("certificate_skills").select("skill_id, skills(name)"),
  ]);
  if (skillLinks.error) throw skillLinks.error;

  const counts = new Map<string, { name: string; count: number }>();
  for (const link of skillLinks.data as unknown as {
    skill_id: string;
    skills: { name: string } | null;
  }[]) {
    if (!link.skills) continue;
    const entry = counts.get(link.skill_id) ?? { name: link.skills.name, count: 0 };
    entry.count += 1;
    counts.set(link.skill_id, entry);
  }
  const skills = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return {
    displayName: (profile.data?.display_name as string | undefined)?.trim() ?? "",
    certificateCount: certCount.count ?? 0,
    recent,
    skills,
  };
}

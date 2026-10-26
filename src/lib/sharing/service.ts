import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomBase62 } from "@/lib/random";

// Owner-side share management. Every call uses the caller's own client, so
// RLS limits it to their shares; the DB trigger makes shares revoke-only.

export type ShareOptions = { show_credential_id: boolean; show_images: boolean };
export type Share = ShareOptions & {
  id: string;
  public_slug: string;
  scope: "portfolio" | "certificate";
  certificate_id: string | null;
  created_at: string;
};

const SHARE_COLUMNS = "id, public_slug, scope, certificate_id, show_credential_id, show_images, created_at";

export class SharingError extends Error {
  constructor(
    public code: "unauthorized" | "not_found" | "display_name_required" | "failed",
    message: string,
  ) {
    super(message);
  }
}

const uuid = z.uuid();

async function requireUserId(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new SharingError("unauthorized", "Please sign in again.");
  return user.id;
}

async function requireOwnedCertificate(supabase: SupabaseClient, certificateId: string) {
  if (!uuid.safeParse(certificateId).success) throw new SharingError("not_found", "Not found.");
  const { data } = await supabase.from("certificates").select("id").eq("id", certificateId).maybeSingle();
  if (!data) throw new SharingError("not_found", "Not found.");
}

export async function getPortfolioShare(supabase: SupabaseClient): Promise<Share | null> {
  const { data, error } = await supabase
    .from("shares")
    .select(SHARE_COLUMNS)
    .eq("scope", "portfolio")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Share | null;
}

export async function getCertificateShare(
  supabase: SupabaseClient,
  certificateId: string,
): Promise<Share | null> {
  await requireOwnedCertificate(supabase, certificateId);
  const { data, error } = await supabase
    .from("shares")
    .select(SHARE_COLUMNS)
    .eq("scope", "certificate")
    .eq("certificate_id", certificateId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Share | null;
}

/** Active single-certificate shares with their titles, for the settings page. */
export async function listCertificateShares(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("shares")
    .select(`${SHARE_COLUMNS}, certificates(title)`)
    .eq("scope", "certificate")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as (Share & { certificates: { title: string } | null })[]).map(
    ({ certificates, ...share }) => ({ ...share, title: certificates?.title ?? "" }),
  );
}

async function insertShare(
  supabase: SupabaseClient,
  userId: string,
  scope: Share["scope"],
  certificateId: string | null,
  options: ShareOptions,
) {
  const { data, error } = await supabase
    .from("shares")
    .insert({
      user_id: userId,
      scope,
      certificate_id: certificateId,
      public_slug: randomBase62(22),
      ...options,
    })
    .select(SHARE_COLUMNS)
    .single();
  if (error || !data) throw new SharingError("failed", "The link could not be created. Please try again.");
  return data as Share;
}

async function revoke(supabase: SupabaseClient, shareId: string) {
  const { data, error } = await supabase
    .from("shares")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("is_active", true)
    .select("id");
  if (error) throw new SharingError("failed", "The link could not be turned off. Please try again.");
  return (data?.length ?? 0) > 0;
}

const DEFAULT_OPTIONS: ShareOptions = { show_credential_id: false, show_images: true };

export async function enablePortfolio(supabase: SupabaseClient) {
  const userId = await requireUserId(supabase);
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.display_name?.trim()) {
    throw new SharingError(
      "display_name_required",
      "Add a display name before turning on your public portfolio.",
    );
  }
  return (await getPortfolioShare(supabase)) ?? insertShare(supabase, userId, "portfolio", null, DEFAULT_OPTIONS);
}

export async function enableCertificateShare(supabase: SupabaseClient, certificateId: string) {
  const userId = await requireUserId(supabase);
  return (
    (await getCertificateShare(supabase, certificateId)) ??
    insertShare(supabase, userId, "certificate", certificateId, DEFAULT_OPTIONS)
  );
}

/** Turns a link off. The slug is gone for good; re-enabling makes a new one. */
export async function disableShare(supabase: SupabaseClient, shareId: string) {
  await requireUserId(supabase);
  if (!uuid.safeParse(shareId).success || !(await revoke(supabase, shareId))) {
    throw new SharingError("not_found", "Not found.");
  }
}

/** Revokes the current link and creates a new one with the same options. */
export async function regenerateShare(supabase: SupabaseClient, shareId: string) {
  const userId = await requireUserId(supabase);
  if (!uuid.safeParse(shareId).success) throw new SharingError("not_found", "Not found.");
  const { data: current } = await supabase
    .from("shares")
    .select(SHARE_COLUMNS)
    .eq("id", shareId)
    .eq("is_active", true)
    .maybeSingle();
  if (!current) throw new SharingError("not_found", "Not found.");
  const share = current as Share;

  await revoke(supabase, share.id);
  return insertShare(supabase, userId, share.scope, share.certificate_id, {
    show_credential_id: share.show_credential_id,
    show_images: share.show_images,
  });
}

export async function updateShareOptions(
  supabase: SupabaseClient,
  shareId: string,
  options: ShareOptions,
) {
  await requireUserId(supabase);
  if (!uuid.safeParse(shareId).success) throw new SharingError("not_found", "Not found.");
  const { data, error } = await supabase
    .from("shares")
    .update(options)
    .eq("id", shareId)
    .eq("is_active", true)
    .select(SHARE_COLUMNS);
  if (error) throw new SharingError("failed", "Your settings could not be saved. Please try again.");
  if (!data?.length) throw new SharingError("not_found", "Not found.");
  return data[0] as Share;
}

export async function updateDisplayName(supabase: SupabaseClient, displayName: string) {
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);
  if (error) throw new SharingError("failed", "Your display name could not be saved.");
}

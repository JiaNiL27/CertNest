import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CertificateDetail } from "@/lib/certificates/queries";
import { hasEnoughDetail } from "./prompt";

export type AiPanelState = {
  enoughDetail: boolean;
  remaining: number;
  saved: Record<string, { content: string; tone: string | null; updated_at: string }>;
};

/** Saved drafts and remaining quota for one certificate (caller's client, RLS). */
export async function loadAiPanelState(
  supabase: SupabaseClient,
  certificate: CertificateDetail,
): Promise<AiPanelState> {
  const [{ data: rows }, { data: remaining }] = await Promise.all([
    supabase
      .from("generated_contents")
      .select("language, tone, content, updated_at")
      .eq("certificate_id", certificate.id)
      .eq("content_type", "linkedin_post"),
    supabase.rpc("ai_quota_remaining"),
  ]);

  return {
    enoughDetail: hasEnoughDetail(certificate),
    remaining: typeof remaining === "number" ? remaining : 0,
    saved: Object.fromEntries(
      (rows ?? []).map((r) => [
        r.language,
        { content: r.content, tone: r.tone, updated_at: r.updated_at },
      ]),
    ),
  };
}

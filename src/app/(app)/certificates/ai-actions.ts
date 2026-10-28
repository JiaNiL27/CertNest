"use server";

import { z } from "zod";
import { loadAiPanelState, type AiPanelState } from "@/lib/ai/panel-state";
import { LANGUAGES } from "@/lib/ai/prompt";
import { getCertificate } from "@/lib/certificates/queries";
import { createClient } from "@/lib/supabase/server";

// Saved AI drafts live in generated_contents (owner-only via RLS, never public).

const languageCode = z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]);

export type { AiPanelState } from "@/lib/ai/panel-state";

export async function getAiPanelState(certificateId: string): Promise<AiPanelState | null> {
  const supabase = await createClient();
  const certificate = await getCertificate(supabase, certificateId);
  return certificate ? loadAiPanelState(supabase, certificate) : null;
}

/** AI requests left in the current hour (shared by every AI feature). */
export async function getAiRemaining(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ai_quota_remaining");
  return error ? null : (data as number);
}

const saveInput = z.object({
  certificateId: z.uuid(),
  language: languageCode,
  tone: z.string().max(40).nullable(),
  content: z.string().trim().min(1, "The post is empty.").max(10000, "The post is too long."),
});

export async function saveLinkedInPost(input: z.input<typeof saveInput>) {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid post." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const { certificateId, language, tone, content } = parsed.data;
  // RLS limits this to the caller's rows; the owner trigger rejects someone
  // else's certificate.
  const { data, error } = await supabase
    .from("generated_contents")
    .upsert(
      {
        user_id: user.id,
        certificate_id: certificateId,
        content_type: "linkedin_post",
        language,
        tone,
        content,
      },
      { onConflict: "certificate_id,content_type,language" },
    )
    .select("updated_at")
    .single();
  if (error || !data) {
    console.error("[ai] save failed", error?.code);
    return { error: "Your post could not be saved. Please try again." };
  }
  return { updated_at: data.updated_at as string };
}

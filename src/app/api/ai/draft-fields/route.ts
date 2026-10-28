import { NextResponse, type NextRequest } from "next/server";
import {
  DRAFT_SCHEMA,
  DRAFT_SYSTEM,
  buildDraftPrompt,
  draftFieldsInput,
  parseDraft,
} from "@/lib/ai/draft-fields";
import { AiError, generateJson } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const STATUS: Record<AiError["code"], number> = {
  not_configured: 503,
  blocked: 422,
  busy: 503,
  failed: 502,
};

const noStore = { "Cache-Control": "no-store" };
const json = (body: object, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...noStore, ...headers } });
const fail = (error: string, status: number, headers: Record<string, string> = {}) =>
  json({ error }, status, headers);

/**
 * "Suggest with AI": drafts a description and/or skills from the form's
 * current title, issuer and platform (the certificate may not be saved yet).
 * Order: sign-in → input → hourly quota → model. Provider failures give the
 * quota back.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Please sign in again.", 401);

  const parsed = draftFieldsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Add a title and issuing organization first.", 400);
  const input = parsed.data;

  const { data: requestId, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_feature: "draft_fields",
  });
  if (quotaError) return fail("Something went wrong. Please try again.", 500);
  if (!requestId) {
    return fail("You've used all your AI requests for this hour. Please try again later.", 429, {
      "X-AI-Remaining": "0",
    });
  }

  let fields;
  try {
    const text = await generateJson({
      system: DRAFT_SYSTEM,
      prompt: buildDraftPrompt(input),
      schema: DRAFT_SCHEMA,
      maxOutputTokens: 1024,
      signal: request.signal,
    });
    fields = parseDraft(text, input.want);
  } catch (e) {
    await createAdminClient().rpc("refund_ai_request", { p_id: requestId, p_user_id: user.id });
    if (e instanceof AiError) return fail(e.message, STATUS[e.code]);
    console.error("[ai] unexpected draft error", e instanceof Error ? e.name : typeof e);
    return fail("Something went wrong. Please try again.", 502);
  }

  const { data: remaining } = await supabase.rpc("ai_quota_remaining");
  return json({ fields }, 200, { "X-AI-Remaining": String(remaining ?? "") });
}

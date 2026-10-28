import { NextResponse, type NextRequest } from "next/server";
import { EXTRACT_PROMPT, EXTRACT_SCHEMA, EXTRACT_SYSTEM, parseExtraction } from "@/lib/ai/extract";
import { AiError, generateJson } from "@/lib/ai/provider";
import { detectFileType } from "@/lib/files/detect";
import { sanitizeImage } from "@/lib/files/sanitize";
import { MAX_FILE_SIZE } from "@/lib/files/service";
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
 * "Fill from file": reads certificate fields out of one PDF or image.
 * Order: sign-in → file checks → hourly quota → model. The file is never
 * stored here; it only goes to the AI provider. Images lose their metadata
 * first. Provider failures give the quota back.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Please sign in again.", 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file first.", 400);
  if (file.size > MAX_FILE_SIZE) return fail("Files must be 10 MB or smaller.", 413);

  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  const type = detectFileType(bytes);
  if (!type) return fail("Only PDF, PNG, JPEG or WebP files can be read.", 415);
  if (type.isImage) {
    try {
      bytes = new Uint8Array(await sanitizeImage(bytes, type));
    } catch {
      return fail("This image couldn't be read.", 422);
    }
  }

  const { data: requestId, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_feature: "file_extract",
  });
  if (quotaError) return fail("Something went wrong. Please try again.", 500);
  if (!requestId) {
    return fail("You've used all your AI requests for this hour. Please try again later.", 429, {
      "X-AI-Remaining": "0",
    });
  }
  const refund = () =>
    createAdminClient()
      .rpc("refund_ai_request", { p_id: requestId, p_user_id: user.id })
      .then(() => undefined);

  let fields;
  try {
    const text = await generateJson({
      system: EXTRACT_SYSTEM,
      prompt: EXTRACT_PROMPT,
      file: { mime: type.mime, bytes },
      schema: EXTRACT_SCHEMA,
      maxOutputTokens: 2048,
      signal: request.signal,
    });
    fields = parseExtraction(text);
  } catch (e) {
    await refund();
    if (e instanceof AiError) return fail(e.message, STATUS[e.code]);
    console.error("[ai] unexpected extract error", e instanceof Error ? e.name : typeof e);
    return fail("Something went wrong while reading the file. Please try again.", 502);
  }

  // No refund when nothing was found: the model still did the work, and
  // refunding would let blank files bypass the limit.
  const { data: remaining } = await supabase.rpc("ai_quota_remaining");
  return json({ fields }, 200, { "X-AI-Remaining": String(remaining ?? "") });
}

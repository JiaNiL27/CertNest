import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildPostPrompt, LANGUAGES, TONES } from "@/lib/ai/prompt";
import { AiError, streamText } from "@/lib/ai/provider";
import { getCertificate } from "@/lib/certificates/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const body = z.object({
  certificateId: z.uuid(),
  language: z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]),
  tone: z.enum(TONES.map((t) => t.value) as [string, ...string[]]),
});

const STATUS: Record<AiError["code"], number> = {
  not_configured: 503,
  blocked: 422,
  busy: 503,
  failed: 502,
};

const noStore = { "Cache-Control": "no-store" };
const json = (error: string, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { ...noStore, ...headers } });

/**
 * Streams a LinkedIn post draft (text/plain) for the caller's own certificate.
 * Order: sign-in → ownership → hourly quota → model. Failures before any text
 * is produced give the quota back.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json("Please sign in again.", 401);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json("Invalid request.", 400);
  const { certificateId, language, tone } = parsed.data;

  // RLS: missing and not-owned are both null.
  const certificate = await getCertificate(supabase, certificateId);
  if (!certificate) return json("Not found.", 404);

  const { data: requestId, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_feature: "linkedin_post",
  });
  if (quotaError) return json("Something went wrong. Please try again.", 500);
  if (!requestId) {
    return json("You've used all your AI requests for this hour. Please try again later.", 429, {
      "X-AI-Remaining": "0",
    });
  }

  const refund = () =>
    createAdminClient()
      .rpc("refund_ai_request", { p_id: requestId, p_user_id: user.id })
      .then(() => undefined);

  const { system, user: prompt } = buildPostPrompt(certificate, {
    language: language as (typeof LANGUAGES)[number]["code"],
    tone: tone as (typeof TONES)[number]["value"],
  });

  // Pull the first chunk before answering, so setup errors become a proper
  // HTTP error (and a refund) instead of a broken stream.
  let iterator: AsyncIterator<string>;
  let first: IteratorResult<string>;
  try {
    iterator = streamText({ system, prompt, maxOutputTokens: 2048, signal: request.signal })[
      Symbol.asyncIterator
    ]();
    first = await iterator.next();
  } catch (e) {
    await refund();
    if (e instanceof AiError) return json(e.message, STATUS[e.code]);
    console.error("[ai] unexpected error", e instanceof Error ? e.name : typeof e);
    return json("Something went wrong while writing. Please try again.", 502);
  }

  const { data: remaining } = await supabase.rpc("ai_quota_remaining");
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
          controller.enqueue(encoder.encode(next.value));
        }
        controller.close();
      } catch (e) {
        // Mid-stream failure: the client keeps the partial text and shows an error.
        controller.error(e instanceof AiError ? e : new Error("stream failed"));
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(stream, {
    headers: {
      ...noStore,
      "Content-Type": "text/plain; charset=utf-8",
      "X-AI-Remaining": String(remaining ?? ""),
    },
  });
}

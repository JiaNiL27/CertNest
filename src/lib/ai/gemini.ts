import "server-only";
import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import { AiError, type GenerateRequest, type JsonRequest, type TextStream } from "./types";

// Gemini Developer API (Google AI Studio key). Server-only: the key never
// reaches the browser.
//
// Flash-Lite is fast and writes short posts well; Flash is the fallback. On
// the free tier either can be overloaded, so each gets a short window to
// start answering before we move on.
const DEFAULT_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-flash-latest";
const FIRST_RESPONSE_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 60_000;
// Overloaded or rate limited: worth trying the next model right away.
const RETRY_NEXT_MODEL = new Set([429, 500, 503]);

const BLOCKED = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
]);

const busy = () => new AiError("busy", "The AI service is busy. Please try again in a minute.");

export async function* streamGemini(req: GenerateRequest): TextStream {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[ai] GEMINI_API_KEY is not set");
    throw new AiError("not_configured", "AI writing isn't available right now.");
  }

  // No SDK retries (they wait with backoff and made requests hang); we move to
  // the fallback model instead.
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
  });
  const models = [...new Set([process.env.GEMINI_MODEL || DEFAULT_MODEL, FALLBACK_MODEL])];

  let stream: AsyncGenerator<{
    text?: string;
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string }[];
  }> | null = null;

  for (const [i, model] of models.entries()) {
    const last = i === models.length - 1;
    // Aborts this attempt if the model doesn't start answering in time, or
    // when the caller goes away.
    const attempt = new AbortController();
    const onCallerAbort = () => attempt.abort();
    req.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const timer = setTimeout(() => attempt.abort(), FIRST_RESPONSE_TIMEOUT_MS);

    try {
      stream = await ai.models.generateContentStream({
        model,
        contents: req.prompt,
        config: {
          systemInstruction: req.system,
          maxOutputTokens: req.maxOutputTokens,
          abortSignal: attempt.signal,
        },
      });
      clearTimeout(timer);
      break;
    } catch (e) {
      clearTimeout(timer);
      req.signal?.removeEventListener("abort", onCallerAbort);
      if (req.signal?.aborted) throw new AiError("failed", "Cancelled.");

      const timedOut = attempt.signal.aborted;
      const overloaded = e instanceof ApiError && RETRY_NEXT_MODEL.has(e.status);
      if (!last && (timedOut || overloaded)) {
        console.warn(`[ai] ${model} ${timedOut ? "timed out" : `unavailable (${(e as ApiError).status})`}, trying ${models[i + 1]}`);
        continue;
      }
      if (timedOut) throw busy();
      throw toAiError(e);
    }
  }
  if (!stream) throw busy();

  try {
    for await (const chunk of stream) {
      if (chunk.promptFeedback?.blockReason) {
        throw new AiError("blocked", "This certificate couldn't be used to write a post.");
      }
      const reason = chunk.candidates?.[0]?.finishReason;
      if (reason && BLOCKED.has(reason)) {
        throw new AiError("blocked", "The AI stopped before finishing. Please try again.");
      }
      if (chunk.text) yield chunk.text;
    }
  } catch (e) {
    throw toAiError(e);
  }
}

// Reading a PDF takes longer than starting a post, so the window is wider.
const FILE_TIMEOUT_MS = 30_000;

/** Answers with JSON that follows req.schema, reading req.file if given. */
export async function generateJsonGemini(req: JsonRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[ai] GEMINI_API_KEY is not set");
    throw new AiError("not_configured", "AI isn't available right now.");
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
  });
  const models = [...new Set([process.env.GEMINI_MODEL || DEFAULT_MODEL, FALLBACK_MODEL])];

  for (const [i, model] of models.entries()) {
    const last = i === models.length - 1;
    const attempt = new AbortController();
    const onCallerAbort = () => attempt.abort();
    req.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const timer = setTimeout(() => attempt.abort(), FILE_TIMEOUT_MS);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              ...(req.file
                ? [{ inlineData: { mimeType: req.file.mime, data: Buffer.from(req.file.bytes).toString("base64") } }]
                : []),
              { text: req.prompt },
            ],
          },
        ],
        config: {
          systemInstruction: req.system,
          maxOutputTokens: req.maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: req.schema,
          abortSignal: attempt.signal,
        },
      });
      const blocked = req.file ? "This file couldn't be read." : "The AI couldn't answer this request.";
      if (response.promptFeedback?.blockReason) throw new AiError("blocked", blocked);
      const reason = response.candidates?.[0]?.finishReason;
      if (reason && BLOCKED.has(reason)) throw new AiError("blocked", blocked);
      return response.text ?? "";
    } catch (e) {
      if (req.signal?.aborted) throw new AiError("failed", "Cancelled.");
      const timedOut = attempt.signal.aborted;
      const overloaded = e instanceof ApiError && RETRY_NEXT_MODEL.has(e.status);
      if (!last && (timedOut || overloaded)) {
        console.warn(`[ai] ${model} ${timedOut ? "timed out" : `unavailable (${(e as ApiError).status})`}, trying ${models[i + 1]}`);
        continue;
      }
      if (timedOut) throw busy();
      throw toAiError(
        e,
        req.file
          ? "Something went wrong while reading the file. Please try again."
          : "Something went wrong. Please try again.",
      );
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener("abort", onCallerAbort);
    }
  }
  throw busy();
}

function toAiError(
  e: unknown,
  fallback = "Something went wrong while writing. Please try again.",
): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof ApiError) {
    console.error("[ai] Gemini error", e.status);
    if (RETRY_NEXT_MODEL.has(e.status)) return busy();
    if (e.status === 401 || e.status === 403) {
      return new AiError("not_configured", "AI isn't available right now.");
    }
  } else {
    console.error("[ai] Gemini request failed", e instanceof Error ? e.name : typeof e);
  }
  return new AiError("failed", fallback);
}

export type AiErrorCode = "not_configured" | "blocked" | "busy" | "failed";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type GenerateRequest = {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
};

export type TextStream = AsyncIterable<string>;

/** Instructions (and optionally one file) in, one JSON document (as text) out. */
export type JsonRequest = {
  system: string;
  prompt: string;
  file?: { mime: string; bytes: Uint8Array };
  /** JSON Schema the answer must follow. */
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal?: AbortSignal;
};

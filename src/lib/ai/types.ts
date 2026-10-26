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

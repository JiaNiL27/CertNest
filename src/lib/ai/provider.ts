import "server-only";
import { streamGemini } from "./gemini";
import { streamMock } from "./mock";
import { AiError, type GenerateRequest, type TextStream } from "./types";

export { AiError } from "./types";

// The one entry point for text generation. Switch providers with AI_PROVIDER;
// adding Claude means one new module and one case here.
export function streamText(req: GenerateRequest): TextStream {
  const provider = process.env.AI_PROVIDER ?? "gemini";

  switch (provider) {
    case "gemini":
      // Gemini's free tier may use prompts to improve Google's products.
      // Refuse to run it in production unless explicitly allowed (paid key).
      if (
        process.env.NODE_ENV === "production" &&
        process.env.AI_ALLOW_GEMINI_IN_PRODUCTION !== "true"
      ) {
        console.error(
          "[ai] Gemini is disabled in production. Switch AI_PROVIDER, or set AI_ALLOW_GEMINI_IN_PRODUCTION=true with a paid key.",
        );
        throw new AiError("not_configured", "AI writing isn't available right now.");
      }
      return streamGemini(req);
    case "mock":
      // Test-only. Refused unless the end-to-end flag is set, so it can't
      // produce placeholder posts for real users by accident.
      if (process.env.CERTNEST_E2E !== "true") {
        console.error("[ai] The mock provider only runs with CERTNEST_E2E=true");
        throw new AiError("not_configured", "AI writing isn't available right now.");
      }
      return streamMock(req);
    default:
      console.error(`[ai] Unknown AI_PROVIDER "${provider}"`);
      throw new AiError("not_configured", "AI writing isn't available right now.");
  }
}

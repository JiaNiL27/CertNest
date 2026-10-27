import "server-only";
import type { GenerateRequest, TextStream } from "./types";

// Deterministic provider for end-to-end tests only (AI_PROVIDER=mock with
// CERTNEST_E2E=true). Echoes the certificate title so tests can check the
// right data was used, and streams in a few chunks like a real model.
export async function* streamMock(req: GenerateRequest): TextStream {
  const title = /^Title: (.+)$/m.exec(req.prompt)?.[1] ?? "this certificate";
  const parts = [
    "[Test draft] ",
    `I completed ${title}. `,
    "This is placeholder text from the test AI provider.\n\n",
    "#Testing",
  ];
  for (const part of parts) {
    if (req.signal?.aborted) return;
    await new Promise((r) => setTimeout(r, 30));
    yield part;
  }
}

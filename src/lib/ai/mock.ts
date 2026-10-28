import "server-only";
import type { GenerateRequest, JsonRequest, TextStream } from "./types";

// Fixed answers for tests. With a file: extraction (the issue date is the
// only date so tests can see the expiration stays untouched). Without: a
// drafted description and skills that echo the title.
export async function generateJsonMock(req: JsonRequest): Promise<string> {
  await new Promise((r) => setTimeout(r, 50));
  if (req.signal?.aborted) throw new Error("aborted");
  if (!req.file) {
    const title = /^Title: (.+)$/m.exec(req.prompt)?.[1] ?? "this certificate";
    return JSON.stringify({
      description: `[Test draft] A course about ${title}.`,
      skills: ["Drafted Skill A", "Drafted Skill B"],
    });
  }
  return JSON.stringify({
    title: "Mock Extracted Certificate",
    issuer_name: "Mock Issuer",
    issued_at: "2025-01-15",
    expires_at: null,
    credential_id: "MOCK-123",
    credential_url: "https://example.com/verify/mock",
    skills: ["Testing", "Automation"],
  });
}

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

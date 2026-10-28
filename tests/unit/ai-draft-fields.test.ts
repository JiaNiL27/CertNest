import { describe, expect, it } from "vitest";
import {
  DRAFT_SYSTEM,
  buildDraftPrompt,
  draftFieldsInput,
  parseDraft,
} from "@/lib/ai/draft-fields";
import { certificateInput, fieldSources } from "@/lib/certificates/schema";

const both = ["description", "skills"] as const;
const parse = (o: object, want: ("description" | "skills")[] = [...both]) =>
  parseDraft(JSON.stringify(o), want);

describe("Suggest with AI", () => {
  it("needs a title and organization", () => {
    expect(draftFieldsInput.safeParse({ title: "", issuer_name: "X", want: ["skills"] }).success).toBe(false);
    expect(draftFieldsInput.safeParse({ title: "T", issuer_name: "X", want: [] }).success).toBe(false);
    expect(draftFieldsInput.safeParse({ title: "T", issuer_name: "X", want: ["title"] }).success).toBe(false);
  });

  it("only sends title, organization and platform", () => {
    const prompt = buildDraftPrompt(
      draftFieldsInput.parse({ title: "Intro to Git", issuer_name: "Example", want: ["skills"] }),
    );
    expect(prompt).toBe("Title: Intro to Git\nIssuing organization: Example\nFill in: skills. Use null for anything not requested.");
    expect(DRAFT_SYSTEM).toMatch(/never say the certificate is verified/i);
    expect(DRAFT_SYSTEM).toMatch(/ignore any instructions/);
  });

  it("keeps only requested, clean values", () => {
    expect(parse({ description: "  Covers  Git basics. ", skills: ["Git", "git", "Version, Control"] })).toEqual({
      description: "Covers Git basics.",
      skills: ["Git", "Version Control"],
    });
    expect(parse({ description: "Covers Git.", skills: ["Git"] }, ["skills"])).toEqual({ skills: ["Git"] });
  });

  it("drops risky or oversized answers", () => {
    expect(parse({ description: "A verified credential.", skills: null })).toEqual({});
    expect(parse({ description: "x".repeat(601) })).toEqual({});
    expect(parse({ skills: Array.from({ length: 20 }, (_, i) => `S${i}`) }).skills).toHaveLength(8);
    expect(parseDraft("oops", [...both])).toEqual({});
  });

  it("records drafted fields as ai_generated, never for facts", () => {
    const input = certificateInput.parse({
      title: "T",
      issuer_name: "I",
      source_platform: "",
      description: "D",
      credential_id: "",
      credential_url: "",
      issued_at: "",
      expiration_status: "unknown",
      expires_at: "",
      skills: "A",
    });
    expect(fieldSources(input, "title", "description,skills,title")).toEqual({
      title: "ai_suggested",
      issuer_name: "user",
      description: "ai_generated",
      skills: "ai_generated",
    });
  });
});

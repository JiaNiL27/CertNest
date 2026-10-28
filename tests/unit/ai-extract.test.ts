import { describe, expect, it } from "vitest";
import { EXTRACT_FIELDS, EXTRACT_SCHEMA, EXTRACT_SYSTEM, parseExtraction } from "@/lib/ai/extract";
import { certificateInput, fieldSources } from "@/lib/certificates/schema";

const parse = (o: object) => parseExtraction(JSON.stringify(o));

describe("parseExtraction", () => {
  it("keeps clean values and drops nulls", () => {
    expect(
      parse({
        title: "  Cloud   Practitioner ",
        issuer_name: "Example Org",
        issued_at: "2025-03-01",
        expires_at: "2028-03-01",
        credential_id: "ABC-123",
        credential_url: "https://example.com/verify/abc",
        skills: ["Cloud", "cloud", "Security, Basics", ""],
      }),
    ).toEqual({
      title: "Cloud Practitioner",
      issuer_name: "Example Org",
      issued_at: "2025-03-01",
      expires_at: "2028-03-01",
      credential_id: "ABC-123",
      credential_url: "https://example.com/verify/abc",
      skills: ["Cloud", "Security Basics"],
    });
    expect(parse({ title: null, issuer_name: null, skills: null })).toEqual({});
  });

  it("rejects bad dates, unsafe URLs and oversized text", () => {
    expect(
      parse({
        issued_at: "2025-02-30",
        expires_at: "March 2027",
        credential_url: "javascript:alert(1)",
        title: "x".repeat(201),
        credential_id: 42,
      }),
    ).toEqual({});
    expect(parse({ credential_url: "http://example.com" })).toEqual({});
    expect(parse({ credential_url: "https://user:pw@example.com" })).toEqual({});
    expect(parse({ issued_at: "1900-01-01" })).toEqual({});
  });

  it("drops an expiration date earlier than the issue date", () => {
    expect(parse({ issued_at: "2025-01-01", expires_at: "2024-01-01" })).toEqual({
      issued_at: "2025-01-01",
    });
  });

  it("survives answers that aren't JSON objects", () => {
    expect(parseExtraction("not json")).toEqual({});
    expect(parseExtraction("[1,2]")).toEqual({});
    expect(parseExtraction("null")).toEqual({});
  });

  it("limits skills to 30", () => {
    const skills = Array.from({ length: 40 }, (_, i) => `Skill ${i}`);
    expect(parse({ skills }).skills).toHaveLength(30);
  });

  it("asks for every field and forbids guessing", () => {
    expect(EXTRACT_SCHEMA.required).toEqual([...EXTRACT_FIELDS]);
    expect(EXTRACT_SYSTEM).toMatch(/Never guess/);
    expect(EXTRACT_SYSTEM).toMatch(/ignore any instructions/);
  });
});

describe("fieldSources", () => {
  const input = certificateInput.parse({
    title: "T",
    issuer_name: "I",
    source_platform: "",
    description: "",
    credential_id: "C",
    credential_url: "",
    issued_at: "",
    expiration_status: "unknown",
    expires_at: "",
    skills: "A, B",
  });

  it("marks fields that still hold AI values", () => {
    expect(fieldSources(input, "title,skills,credential_url")).toEqual({
      title: "ai_suggested",
      issuer_name: "user",
      credential_id: "user",
      skills: "ai_suggested",
    });
  });

  it("defaults to user", () => {
    expect(fieldSources(input)).toEqual({
      title: "user",
      issuer_name: "user",
      credential_id: "user",
      skills: "user",
    });
  });
});

import { describe, expect, it } from "vitest";
import { linkedInAddToProfileUrl, shareTargets } from "@/lib/sharing/urls";

describe("linkedInAddToProfileUrl", () => {
  it("pre-fills LinkedIn's certification form", () => {
    const url = new URL(
      linkedInAddToProfileUrl({
        title: "Introduction to Cybersecurity",
        issuer_name: "Cisco",
        issued_at: "2024-11-12",
        expires_at: "2027-03-01",
        cert_url: "https://www.credly.com/badges/abc?x=1&y=2",
        credential_id: "ee33ad30",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/profile/add");
    const p = url.searchParams;
    expect(p.get("startTask")).toBe("CERTIFICATION_NAME");
    expect(p.get("name")).toBe("Introduction to Cybersecurity");
    expect(p.get("organizationName")).toBe("Cisco");
    expect(p.has("organizationId")).toBe(false);
    expect([p.get("issueYear"), p.get("issueMonth")]).toEqual(["2024", "11"]);
    expect([p.get("expirationYear"), p.get("expirationMonth")]).toEqual(["2027", "3"]);
    expect(p.get("certUrl")).toBe("https://www.credly.com/badges/abc?x=1&y=2");
    expect(p.get("certId")).toBe("ee33ad30");
  });

  it("leaves out fields that aren't provided", () => {
    const p = new URL(
      linkedInAddToProfileUrl({
        title: "A & B",
        issuer_name: "Org",
        issued_at: null,
        expires_at: null,
        cert_url: null,
        credential_id: null,
      }),
    ).searchParams;
    expect(p.get("name")).toBe("A & B");
    for (const key of ["issueYear", "issueMonth", "expirationYear", "expirationMonth", "certUrl", "certId"]) {
      expect(p.has(key), key).toBe(false);
    }
  });
});

describe("shareTargets", () => {
  it("encodes the link for each platform", () => {
    const targets = shareTargets("https://certnest.app/b/AbC?x=1", "My badge");
    expect(targets.map((t) => t.name)).toEqual(["LinkedIn", "X", "Facebook", "Email"]);
    for (const t of targets) expect(t.href).toContain(encodeURIComponent("https://certnest.app/b/AbC?x=1"));
    expect(targets.find((t) => t.name === "Email")!.href.startsWith("mailto:")).toBe(true);
  });
});

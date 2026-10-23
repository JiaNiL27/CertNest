import { describe, expect, it } from "vitest";
import {
  expirationDateText,
  expirationState,
  hasIssuerLink,
  statusLabel,
  todayUtc,
} from "@/lib/certificates/display";

const TODAY = "2026-10-23";
const dated = (expires_at: string) => ({ expiration_status: "has_date" as const, expires_at });

describe("expirationState", () => {
  it("treats a future or same-day expiration as still valid", () => {
    expect(expirationState(dated("2027-01-01"), TODAY)).toEqual({ kind: "expires", date: "2027-01-01" });
    expect(expirationState(dated(TODAY), TODAY).kind).toBe("expires");
  });

  it("is expired from the day after the expiration date", () => {
    expect(expirationState(dated("2026-10-22"), TODAY)).toEqual({ kind: "expired", date: "2026-10-22" });
  });

  it("handles never and unknown", () => {
    expect(expirationState({ expiration_status: "never", expires_at: null }, TODAY).kind).toBe("never");
    expect(expirationState({ expiration_status: "unknown", expires_at: null }, TODAY).kind).toBe("unknown");
    // Defensive: has_date without a date is shown as unknown.
    expect(expirationState({ expiration_status: "has_date", expires_at: null }, TODAY).kind).toBe("unknown");
  });
});

describe("labels", () => {
  it("never says Verified", () => {
    const states = [
      expirationState(dated("2027-01-01"), TODAY),
      expirationState(dated("2020-01-01"), TODAY),
      expirationState({ expiration_status: "never", expires_at: null }, TODAY),
      expirationState({ expiration_status: "unknown", expires_at: null }, TODAY),
    ];
    for (const s of states) {
      expect(statusLabel(s)).not.toMatch(/verified/i);
      expect(expirationDateText(s)).not.toMatch(/verified/i);
    }
  });

  it("uses the agreed wording", () => {
    expect(statusLabel(expirationState(dated("2027-11-12"), TODAY))).toBe("Expires Nov 12, 2027");
    expect(statusLabel(expirationState(dated("2025-01-01"), TODAY))).toBe("Expired");
    expect(statusLabel({ kind: "never" })).toBe("Does not expire");
    expect(statusLabel({ kind: "unknown" })).toBe("Status unknown");
    expect(expirationDateText({ kind: "unknown" })).toBe("Expiration date not provided");
    expect(expirationDateText({ kind: "never" })).toBe("Does not expire");
    expect(expirationDateText({ kind: "expired", date: "2025-01-01" })).toBe("Jan 1, 2025 (expired)");
  });

  it("formats plain dates without time zone shifts", () => {
    expect(statusLabel({ kind: "expires", date: "2027-01-01" })).toBe("Expires Jan 1, 2027");
  });
});

describe("helpers", () => {
  it("todayUtc uses the UTC calendar day", () => {
    expect(todayUtc(new Date("2026-10-23T23:30:00-05:00"))).toBe("2026-10-24");
  });

  it("only treats http(s) URLs as issuer links", () => {
    expect(hasIssuerLink({ credential_url: "https://www.credly.com/badges/x" })).toBe(true);
    expect(hasIssuerLink({ credential_url: null })).toBe(false);
    expect(hasIssuerLink({ credential_url: "javascript:alert(1)" })).toBe(false);
  });
});

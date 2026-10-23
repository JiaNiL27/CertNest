// Display rules for certificate data. Pure functions, shared by server and
// client components. CertNest never claims a certificate is "Verified": the
// data is self-reported, so viewers verify through the issuer's own link.

import { formatDate } from "@/lib/format";

export const NOT_PROVIDED = "Not provided";

export type ExpirationFields = {
  expiration_status: "has_date" | "never" | "unknown";
  expires_at: string | null;
};

export type ExpirationState =
  | { kind: "expires"; date: string }
  | { kind: "expired"; date: string }
  | { kind: "never" }
  | { kind: "unknown" };

/** Today's date (YYYY-MM-DD) in UTC, the reference for "expired". */
export function todayUtc(now: Date = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** A certificate is expired from the day after its expiration date. */
export function expirationState(c: ExpirationFields, today: string): ExpirationState {
  if (c.expiration_status === "never") return { kind: "never" };
  if (c.expiration_status === "has_date" && c.expires_at) {
    return c.expires_at < today
      ? { kind: "expired", date: c.expires_at }
      : { kind: "expires", date: c.expires_at };
  }
  return { kind: "unknown" };
}

/** Short status label for chips. */
export function statusLabel(state: ExpirationState) {
  switch (state.kind) {
    case "expires":
      return `Expires ${formatDate(state.date)}`;
    case "expired":
      return "Expired";
    case "never":
      return "Does not expire";
    case "unknown":
      return "Status unknown";
  }
}

/** Value for the "Expiration date" field in Badge Details. */
export function expirationDateText(state: ExpirationState) {
  switch (state.kind) {
    case "expires":
      return formatDate(state.date);
    case "expired":
      return `${formatDate(state.date)} (expired)`;
    case "never":
      return "Does not expire";
    case "unknown":
      return "Expiration date not provided";
  }
}

export function hasIssuerLink(c: { credential_url: string | null }) {
  return !!c.credential_url && /^https?:\/\//i.test(c.credential_url);
}

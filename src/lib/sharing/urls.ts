// Public URL shapes and social share links. Pure helpers (no secrets), so
// client components can use them with an absolute base URL from the server.

export const portfolioPath = (slug: string) => `/p/${slug}`;
export const portfolioBadgePath = (slug: string, publicId: string) => `/p/${slug}/${publicId}`;
export const badgePath = (slug: string) => `/b/${slug}`;
export const publicImagePath = (scope: "p" | "b", slug: string, key: string) =>
  `/${scope}/${slug}/img/${key}`;

/**
 * LinkedIn "Add to Profile" link: opens LinkedIn's own "Add license or
 * certification" form, pre-filled, for the member to review and save.
 * Format: https://addtoprofile.linkedin.com (organizationName, not
 * organizationId, since we don't know issuers' LinkedIn page ids).
 */
export function linkedInAddToProfileUrl(cert: {
  title: string;
  issuer_name: string;
  issued_at: string | null;
  expires_at: string | null;
  cert_url: string | null;
  credential_id: string | null;
}) {
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.title,
    organizationName: cert.issuer_name,
  });
  const ym = (date: string) => ({ year: date.slice(0, 4), month: String(Number(date.slice(5, 7))) });
  if (cert.issued_at) {
    const { year, month } = ym(cert.issued_at);
    params.set("issueYear", year);
    params.set("issueMonth", month);
  }
  if (cert.expires_at) {
    const { year, month } = ym(cert.expires_at);
    params.set("expirationYear", year);
    params.set("expirationMonth", month);
  }
  if (cert.cert_url) params.set("certUrl", cert.cert_url);
  if (cert.credential_id) params.set("certId", cert.credential_id);
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export type ShareTarget ={ name: "LinkedIn" | "X" | "Facebook" | "Email"; href: string };

/** Platform share links. LinkedIn only accepts a URL; post text is copied separately. */
export function shareTargets(url: string, title: string): ShareTarget[] {
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(`I earned "${title}"`);
  const subject = encodeURIComponent(`My badge: ${title}`);
  const body = encodeURIComponent(`I wanted to share my badge "${title}" with you:\n\n${url}`);
  return [
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: "X", href: `https://x.com/intent/tweet?url=${u}&text=${text}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "Email", href: `mailto:?subject=${subject}&body=${body}` },
  ];
}

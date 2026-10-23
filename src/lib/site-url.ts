import "server-only";

// Base URL used in auth email links. Taken from config, never from request
// headers, so a spoofed Host header cannot redirect users elsewhere.
export function getSiteUrl() {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

// Only allow same-origin relative paths as post-auth destinations.
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}

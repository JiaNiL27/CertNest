// Custom portfolio address rules. Mirrors private.handle_is_valid in the
// database (which is the source of truth); used for friendly messages.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

const RESERVED = new Set([
  "admin", "administrator", "api", "app", "auth", "b", "badge", "badges", "certificates",
  "certnest", "dashboard", "help", "login", "logout", "me", "new", "p", "portfolio",
  "privacy", "profile", "root", "settings", "signup", "skills", "staff", "support",
  "system", "terms", "u", "user", "users", "www",
]);

const PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Returns an error message, or null when the handle is acceptable. */
export function handleProblem(handle: string): string | null {
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
    return `Use ${HANDLE_MIN}–${HANDLE_MAX} characters.`;
  }
  if (!/^[a-z0-9-]+$/.test(handle)) {
    return "Use only lowercase letters, numbers and hyphens.";
  }
  if (!PATTERN.test(handle) || handle.includes("--")) {
    return "Start and end with a letter or number, and don't use two hyphens in a row.";
  }
  if (RESERVED.has(handle)) return "That address is reserved. Please choose another.";
  return null;
}

export const normalizeHandle = (raw: string) => raw.trim().toLowerCase();

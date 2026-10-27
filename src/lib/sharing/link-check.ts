import { createClient } from "@supabase/supabase-js";

// Used by the proxy so invalid public links get a real HTTP 404 before the
// page starts streaming. Calls the same whitelisted functions as the pages,
// with the anon key and no user session.

const SLUG = /^[0-9A-Za-z]{22}$/;
const PUBLIC_ID = /^[0-9a-f]{32}$/;
const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
// Image and preview-image routes answer 404 themselves.
const SELF_CHECKED = new Set(["img", "og"]);

export type LinkCheck = "valid" | "invalid" | "not-public-page";

type Target =
  | { fn: "get_public_portfolio" | "get_public_certificate"; arg: { p_slug: string } }
  | { fn: "get_public_portfolio_by_handle"; arg: { p_handle: string } };

/** Which public page a path is, and which badge (if any) it must contain. */
function parse(pathname: string): { target: Target; publicId?: string } | "invalid" | null {
  const parts = pathname.replace(/\/+$/, "").split("/").slice(1);
  const [scope, id, a, b] = parts;
  if (!["p", "b", "u"].includes(scope) || !id) return null;
  if (a && SELF_CHECKED.has(a)) return null;

  if (scope === "b") {
    if (a || !SLUG.test(id)) return "invalid";
    return { target: { fn: "get_public_certificate", arg: { p_slug: id } } };
  }

  if (scope === "p") {
    if (!SLUG.test(id)) return "invalid";
    const target: Target = { fn: "get_public_portfolio", arg: { p_slug: id } };
    if (!a || (a === "skills" && !b)) return { target };
    if (!b && PUBLIC_ID.test(a)) return { target, publicId: a };
    return "invalid";
  }

  // scope === "u"
  if (!HANDLE.test(id)) return "invalid";
  const target: Target = { fn: "get_public_portfolio_by_handle", arg: { p_handle: id } };
  if (!a || (a === "skills" && !b)) return { target };
  if (a === "badges" && b && PUBLIC_ID.test(b) && parts.length === 4) return { target, publicId: b };
  return "invalid";
}

export async function checkPublicLink(pathname: string): Promise<LinkCheck> {
  const parsed = parse(pathname);
  if (parsed === null) return "not-public-page";
  if (parsed === "invalid") return "invalid";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return "valid"; // let the page decide

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc(parsed.target.fn, parsed.target.arg);
  if (error) return "valid"; // transient failure: the page re-checks
  if (!data) return "invalid";
  if (parsed.publicId) {
    const certificates = (data as { certificates: { public_id: string }[] }).certificates;
    return certificates.some((c) => c.public_id === parsed.publicId) ? "valid" : "invalid";
  }
  return "valid";
}

import { createClient } from "@supabase/supabase-js";

// Used by the proxy so invalid public links get a real HTTP 404 before the
// page starts streaming. Calls the same whitelisted functions as the pages,
// with the anon key and no user session.

const SLUG = /^[0-9A-Za-z]{22}$/;
const PUBLIC_ID = /^[0-9a-f]{32}$/;
const PUBLIC_PAGE = /^\/(p|b)\/([^/]+)(?:\/([^/]+))?\/?$/;

export type LinkCheck = "valid" | "invalid" | "not-public-page";

export async function checkPublicLink(pathname: string): Promise<LinkCheck> {
  const match = PUBLIC_PAGE.exec(pathname);
  if (!match) return "not-public-page";
  const [, scope, slug, publicId] = match;
  // Image routes (badge images, generated preview) answer 404 themselves.
  if (publicId === "img" || publicId === "og") return "not-public-page";

  if (!SLUG.test(slug)) return "invalid";
  if (scope === "b" && publicId) return "invalid";
  if (publicId && !PUBLIC_ID.test(publicId)) return "invalid";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return "valid"; // let the page decide

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fn = scope === "p" ? "get_public_portfolio" : "get_public_certificate";
  const { data, error } = await supabase.rpc(fn, { p_slug: slug });
  if (error) return "valid"; // transient failure: the page re-checks
  if (!data) return "invalid";
  if (publicId) {
    const certificates = (data as { certificates: { public_id: string }[] }).certificates;
    return certificates.some((c) => c.public_id === publicId) ? "valid" : "invalid";
  }
  return "valid";
}

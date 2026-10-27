import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

// Public reads. Uses the anon key with no user session, and only calls the
// whitelisted security definer functions (never table queries).

export type PublicCertificate = {
  public_id: string;
  title: string;
  issuer_name: string;
  source_platform: string | null;
  description: string | null;
  issued_at: string | null;
  expiration_status: "has_date" | "never" | "unknown";
  expires_at: string | null;
  credential_url: string | null;
  credential_id: string | null;
  skills: string[];
  image_key: string | null;
};

export type PublicPortfolio = { display_name: string; certificates: PublicCertificate[] };
export type PublicBadge = { display_name: string; certificate: PublicCertificate };

const SLUG = /^[0-9A-Za-z]{22}$/;

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing public Supabase settings");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// cache(): page and generateMetadata share one call per request.
export const getPublicPortfolio = cache(async (slug: string): Promise<PublicPortfolio | null> => {
  if (!SLUG.test(slug)) return null;
  const { data, error } = await publicClient().rpc("get_public_portfolio", { p_slug: slug });
  if (error) throw error;
  return (data as PublicPortfolio | null) ?? null;
});

const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** Same whitelisted data as getPublicPortfolio, looked up by custom address. */
export const getPublicPortfolioByHandle = cache(
  async (handle: string): Promise<PublicPortfolio | null> => {
    if (!HANDLE.test(handle)) return null;
    const { data, error } = await publicClient().rpc("get_public_portfolio_by_handle", {
      p_handle: handle,
    });
    if (error) throw error;
    return (data as PublicPortfolio | null) ?? null;
  },
);

export const getPublicBadge = cache(async (slug: string): Promise<PublicBadge | null> => {
  if (!SLUG.test(slug)) return null;
  const { data, error } = await publicClient().rpc("get_public_certificate", { p_slug: slug });
  if (error) throw error;
  return (data as PublicBadge | null) ?? null;
});

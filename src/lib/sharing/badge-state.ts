import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CertificateDetail } from "@/lib/certificates/queries";
import { getSiteUrl } from "@/lib/site-url";
import {
  getCertificateShare,
  getPortfolioHomePath,
  type Share,
  type ShareOptions,
} from "./service";
import { badgePath, portfolioPath } from "./urls";

export type ShareView = ShareOptions & { id: string; url: string };

export type ShareBadgeInfo = {
  title: string;
  issuer_name: string;
  issued_at: string | null;
  expires_at: string | null;
  credential_url: string | null;
  credential_id: string | null;
  hidden: boolean;
  badgeFileId: string | null;
  originalFileId: string | null;
};

export type ShareBadgeState = {
  share: ShareView | null;
  badge: ShareBadgeInfo;
  portfolioUrl: string | null;
};

export function toShareView(share: Share): ShareView {
  const path =
    share.scope === "portfolio" ? portfolioPath(share.public_slug) : badgePath(share.public_slug);
  return {
    id: share.id,
    url: `${getSiteUrl()}${path}`,
    show_credential_id: share.show_credential_id,
    show_images: share.show_images,
  };
}

/** Everything the owner's share panel needs (caller's client, RLS). */
export async function loadShareBadgeState(
  supabase: SupabaseClient,
  certificate: CertificateDetail,
): Promise<ShareBadgeState> {
  const [share, portfolioHome] = await Promise.all([
    getCertificateShare(supabase, certificate.id),
    getPortfolioHomePath(supabase),
  ]);
  return {
    share: share ? toShareView(share) : null,
    badge: {
      title: certificate.title,
      issuer_name: certificate.issuer_name,
      issued_at: certificate.issued_at,
      expires_at: certificate.expiration_status === "has_date" ? certificate.expires_at : null,
      credential_url: certificate.credential_url,
      credential_id: certificate.credential_id,
      hidden: certificate.hidden_from_portfolio,
      badgeFileId: certificate.badge?.id ?? null,
      originalFileId: certificate.original?.id ?? null,
    },
    portfolioUrl: portfolioHome ? `${getSiteUrl()}${portfolioHome}` : null,
  };
}

"use server";

import { z } from "zod";
import { getCertificate } from "@/lib/certificates/queries";
import { getSiteUrl } from "@/lib/site-url";
import { badgePath, portfolioPath } from "@/lib/sharing/urls";
import {
  SharingError,
  disableShare,
  enableCertificateShare,
  enablePortfolio,
  getCertificateShare,
  getPortfolioShare,
  regenerateShare,
  updateDisplayName,
  updateShareOptions,
  type Share,
  type ShareOptions,
} from "@/lib/sharing/service";
import { createClient } from "@/lib/supabase/server";

export type ShareView = ShareOptions & { id: string; url: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

function toView(share: Share): ShareView {
  const path =
    share.scope === "portfolio" ? portfolioPath(share.public_slug) : badgePath(share.public_slug);
  return {
    id: share.id,
    url: `${getSiteUrl()}${path}`,
    show_credential_id: share.show_credential_id,
    show_images: share.show_images,
  };
}

async function run<T>(fn: (supabase: Awaited<ReturnType<typeof createClient>>) => Promise<T>) {
  try {
    return { ok: true, data: await fn(await createClient()) } as Result<T>;
  } catch (e) {
    if (e instanceof SharingError) return { ok: false, error: e.message } as Result<T>;
    console.error("[sharing] unexpected error", (e as { code?: string })?.code);
    return { ok: false, error: GENERIC_ERROR } as Result<T>;
  }
}

const options = z.object({ show_credential_id: z.boolean(), show_images: z.boolean() });

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

/** Everything the owner's share panel needs. Owner-only via RLS. */
export async function getCertificateShareState(certificateId: string) {
  return run(async (supabase) => {
    const [share, certificate, portfolio] = await Promise.all([
      getCertificateShare(supabase, certificateId),
      getCertificate(supabase, certificateId),
      getPortfolioShare(supabase),
    ]);
    if (!certificate) throw new SharingError("not_found", "Not found.");
    const badge: ShareBadgeInfo = {
      title: certificate.title,
      issuer_name: certificate.issuer_name,
      issued_at: certificate.issued_at,
      expires_at: certificate.expiration_status === "has_date" ? certificate.expires_at : null,
      credential_url: certificate.credential_url,
      credential_id: certificate.credential_id,
      hidden: certificate.hidden_from_portfolio,
      badgeFileId: certificate.badge?.id ?? null,
      originalFileId: certificate.original?.id ?? null,
    };
    return {
      share: share ? toView(share) : null,
      badge,
      portfolioUrl: portfolio ? `${getSiteUrl()}${portfolioPath(portfolio.public_slug)}` : null,
    };
  });
}

export async function enableCertificateShareAction(certificateId: string) {
  return run(async (supabase) => toView(await enableCertificateShare(supabase, certificateId)));
}

export async function enablePortfolioAction() {
  return run(async (supabase) => toView(await enablePortfolio(supabase)));
}

export async function disableShareAction(shareId: string) {
  return run(async (supabase) => {
    await disableShare(supabase, shareId);
    return null;
  });
}

export async function regenerateShareAction(shareId: string) {
  return run(async (supabase) => toView(await regenerateShare(supabase, shareId)));
}

export async function updateShareOptionsAction(shareId: string, input: ShareOptions) {
  const parsed = options.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR } as Result<ShareView>;
  return run(async (supabase) => toView(await updateShareOptions(supabase, shareId, parsed.data)));
}

export async function updateDisplayNameAction(displayName: string) {
  const parsed = z.string().trim().max(80).safeParse(displayName);
  if (!parsed.success) {
    return { ok: false, error: "Display name must be 80 characters or fewer." } as Result<string>;
  }
  return run(async (supabase) => {
    if (!parsed.data && (await getPortfolioShare(supabase))) {
      throw new SharingError(
        "display_name_required",
        "Your public portfolio is on, so your display name can't be empty.",
      );
    }
    await updateDisplayName(supabase, parsed.data);
    return parsed.data;
  });
}

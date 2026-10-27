"use server";

import { z } from "zod";
import { getCertificate } from "@/lib/certificates/queries";
import { handleProblem, normalizeHandle } from "@/lib/sharing/handle";
import { loadShareBadgeState, toShareView, type ShareView } from "@/lib/sharing/badge-state";
import {
  SharingError,
  disableShare,
  enableCertificateShare,
  enablePortfolio,
  getPortfolioShare,
  regenerateShare,
  setHandle,
  updateDisplayName,
  updateShareOptions,
  type ShareOptions,
} from "@/lib/sharing/service";
import { createClient } from "@/lib/supabase/server";

export type { ShareBadgeInfo, ShareView } from "@/lib/sharing/badge-state";
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

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

/** Share panel data for the dialog (the details page loads it on the server). */
export async function getCertificateShareState(certificateId: string) {
  return run(async (supabase) => {
    const certificate = await getCertificate(supabase, certificateId);
    if (!certificate) throw new SharingError("not_found", "Not found.");
    return loadShareBadgeState(supabase, certificate);
  });
}

export async function enableCertificateShareAction(certificateId: string) {
  return run(async (supabase) => toShareView(await enableCertificateShare(supabase, certificateId)));
}

export async function enablePortfolioAction() {
  return run(async (supabase) => toShareView(await enablePortfolio(supabase)));
}

export async function disableShareAction(shareId: string) {
  return run(async (supabase) => {
    await disableShare(supabase, shareId);
    return null;
  });
}

export async function regenerateShareAction(shareId: string) {
  return run(async (supabase) => toShareView(await regenerateShare(supabase, shareId)));
}

export async function updateShareOptionsAction(shareId: string, input: ShareOptions) {
  const parsed = options.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR } as Result<ShareView>;
  return run(async (supabase) => toShareView(await updateShareOptions(supabase, shareId, parsed.data)));
}

type HandleResult = { handle: string | null; portfolio: ShareView | null };

/**
 * Sets or clears the custom portfolio address. Returns the saved handle and
 * the portfolio link, which is new after a removal (the DB trigger issues it).
 */
export async function updateHandleAction(raw: string | null) {
  const handle = raw === null ? null : normalizeHandle(raw);
  if (handle !== null) {
    const problem = handleProblem(handle);
    if (problem) return { ok: false, error: problem } as Result<HandleResult>;
  }
  return run(async (supabase): Promise<HandleResult> => {
    await setHandle(supabase, handle);
    const share = await getPortfolioShare(supabase);
    return { handle, portfolio: share && toShareView(share) };
  });
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

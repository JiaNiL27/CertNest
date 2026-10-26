"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ChevronDown,
  Download,
  FileText,
  Image as ImageIcon,
  Link2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { AiPostPanel } from "@/components/ai/ai-post-panel";
import type { AiPanelState } from "@/app/(app)/certificates/ai-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { BadgeIcon, ownerImageSrc } from "@/components/certnest/badge-icon";
import {
  enableCertificateShareAction,
  getCertificateShareState,
  type ShareBadgeInfo,
  type ShareView,
} from "@/app/(app)/settings/sharing/actions";
import { linkedInAddToProfileUrl } from "@/lib/sharing/urls";
import { CACHE_NOTE, LinkRow, LinkSettings, ShareButtons } from "./share-link-controls";

type State = { share: ShareView | null; badge: ShareBadgeInfo; portfolioUrl: string | null };

function Step({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-[2rem_1fr] gap-x-3 gap-y-3">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-full bg-primary/10 font-heading text-sm font-semibold text-primary"
      >
        {n}
      </span>
      <div>
        <h4 className="font-sans font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="col-start-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}

// Owner's sharing hub for one badge: add it to LinkedIn, post a public link,
// or download your own files.
export function ShareBadgePanel({
  certificateId,
  onPortfolioUrl,
  initial,
  initialAi,
}: {
  certificateId: string;
  onPortfolioUrl?: (url: string | null) => void;
  /** Server-loaded state; when given, the panel doesn't fetch on mount. */
  initial?: State;
  initialAi?: AiPanelState;
}) {
  const [state, setState] = useState<State | null>(initial ?? null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initial) return;
    let active = true;
    getCertificateShareState(certificateId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setState(result.data);
        onPortfolioUrl?.(result.data.portfolioUrl);
      } else setError(result.error);
    });
    return () => {
      active = false;
    };
    // `initial` is only read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificateId, onPortfolioUrl]);

  if (!state) {
    return (
      <p className="py-8 text-center text-muted-foreground">{error ?? "Loading…"}</p>
    );
  }

  const { share, badge } = state;
  const setShare = (next: ShareView | null) => setState((s) => s && { ...s, share: next });

  // Prefer the issuer's own page; it's permanent and more trustworthy than a
  // CertNest link that can be turned off.
  const certUrl = badge.credential_url ?? share?.url ?? null;
  const addToProfile = linkedInAddToProfileUrl({ ...badge, cert_url: certUrl });

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-center gap-4 rounded-xl bg-linear-to-r from-secondary to-transparent p-4">
        <BadgeIcon
          issuer={badge.issuer_name}
          imageSrc={ownerImageSrc(badge.badgeFileId)}
          className="size-16 [&>div]:text-2xl"
        />
        <div className="min-w-0">
          <h3 className="truncate text-xl font-semibold">Share “{badge.title}”</h3>
          <p className="text-sm text-muted-foreground">from {badge.issuer_name}</p>
        </div>
      </header>

      <Step
        n={1}
        title="Add it to your LinkedIn profile"
        description="Opens LinkedIn’s “Add license or certification” form, filled in for you. Check it and press Save on LinkedIn."
      >
        <a
          href={addToProfile}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "lg", className: "w-fit" })}
        >
          <UserPlus aria-hidden /> Add to LinkedIn profile
        </a>
        {!badge.credential_url && !share && (
          <p className="text-xs text-muted-foreground">
            Tip: create a public link below first to include a link to this badge.
          </p>
        )}
      </Step>

      <Step
        n={2}
        title="Post a public link"
        description="A read-only page for this badge that anyone with the link can open."
      >
        {badge.hidden && (
          <p className="rounded-lg bg-muted p-3 text-sm">
            This badge is hidden from your portfolio, but anyone with its own link can still view it.
          </p>
        )}
        {share ? (
          <>
            <LinkRow url={share.url} />
            <ShareButtons url={share.url} title={badge.title} />
            <p className="text-xs text-muted-foreground">
              A LinkedIn post can only include the link; copy any text you want to add. {CACHE_NOTE}
            </p>
            <details className="group rounded-lg border px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" aria-hidden /> Write the post text with AI
                </span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="pt-4">
                <AiPostPanel certificateId={certificateId} initial={initialAi} />
              </div>
            </details>
            <details className="group rounded-lg border px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                Link settings
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="pt-4">
                <LinkSettings share={share} onChange={setShare} />
              </div>
            </details>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-fit"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const result = await enableCertificateShareAction(certificateId);
                if (result.ok) setShare(result.data);
                else setError(result.error);
              })
            }
          >
            <Link2 aria-hidden /> {pending ? "Creating…" : "Create public link"}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </Step>

      {(badge.badgeFileId || badge.originalFileId) && (
        <Step n={3} title="Keep a copy" description="Your own uploaded files. Only you can download them.">
          <div className="flex flex-wrap gap-2">
            {badge.badgeFileId && (
              <a href={`/api/files?id=${badge.badgeFileId}`} className={buttonVariants({ variant: "outline" })}>
                <ImageIcon aria-hidden /> Badge image <Download aria-hidden />
              </a>
            )}
            {badge.originalFileId && (
              <a href={`/api/files?id=${badge.originalFileId}`} className={buttonVariants({ variant: "outline" })}>
                <FileText aria-hidden /> Certificate file <Download aria-hidden />
              </a>
            )}
          </div>
        </Step>
      )}
    </div>
  );
}

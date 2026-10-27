"use client";

import { useState, useTransition } from "react";
import { AtSign, ExternalLink, Mail, MessageCircle, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/certnest/copy-button";
import {
  disableShareAction,
  regenerateShareAction,
  updateShareOptionsAction,
  type ShareView,
} from "@/app/(app)/settings/sharing/actions";
import { shareTargets, type ShareTarget } from "@/lib/sharing/urls";

type ActionResult = { ok: true; data: ShareView | null } | { ok: false; error: string };

/** The public URL with copy and preview. */
export function LinkRow({ url }: { url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-3 py-2">
      <input
        readOnly
        value={url}
        aria-label="Public link"
        className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
        onFocus={(e) => e.currentTarget.select()}
      />
      <CopyButton value={url} label="Copy link" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-secondary"
      >
        <ExternalLink className="size-3.5" aria-hidden /> Preview as visitor
      </a>
    </div>
  );
}

const TARGET_LABEL: Record<ShareTarget["name"], string> = {
  LinkedIn: "LinkedIn post",
  X: "X",
  Facebook: "Facebook",
  Email: "Email",
};
const TARGET_ICON = { LinkedIn: Send, X: AtSign, Facebook: MessageCircle, Email: Mail } as const;

/** Compact share pills for posting the link. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {shareTargets(url, title).map((t) => {
        const Icon = TARGET_ICON[t.name];
        return (
          <a
            key={t.name}
            href={t.href}
            target={t.name === "Email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            <Icon className="size-4 text-primary" aria-hidden />
            {TARGET_LABEL[t.name]}
          </a>
        );
      })}
    </div>
  );
}

/** Visibility options, new link and turn off. */
export function LinkSettings({
  share,
  onChange,
  canRegenerate = true,
}: {
  share: ShareView;
  onChange: (share: ShareView | null) => void;
  /** False while a custom address replaces the random link. */
  canRegenerate?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function act(fn: () => Promise<ActionResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) onChange(result.data);
      else setError(result.error);
    });
  }

  const toggle = (key: "show_credential_id" | "show_images") =>
    act(() =>
      updateShareOptionsAction(share.id, {
        show_credential_id: share.show_credential_id,
        show_images: share.show_images,
        [key]: !share[key],
      }),
    );

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 text-sm" disabled={pending}>
        <legend className="mb-1 font-medium">On the public page</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={share.show_images}
            onChange={() => toggle("show_images")}
          />
          Show badge images
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={share.show_credential_id}
            onChange={() => toggle("show_credential_id")}
          />
          Show Credential IDs
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canRegenerate && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => act(() => regenerateShareAction(share.id))}
          >
            <RefreshCw aria-hidden /> New link
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => act(() => disableShareAction(share.id))}
        >
          Turn off link
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {canRegenerate
          ? "A new link replaces this one; the old link stops working immediately. Turning a link off is permanent for that link."
          : "Turning the link off hides your portfolio. Your custom address stays yours and works again when you turn it back on."}
      </p>
    </div>
  );
}

export const CACHE_NOTE =
  "Sites like LinkedIn keep their own preview of shared links, which we can’t remove even after you turn the link off.";

/** Full controls for one link (used for the portfolio in settings). */
export function ShareLinkControls({
  share,
  title,
  onChange,
  canRegenerate,
}: {
  share: ShareView;
  title: string;
  onChange: (share: ShareView | null) => void;
  canRegenerate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <LinkRow url={share.url} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Post the link</p>
        <ShareButtons url={share.url} title={title} />
        <p className="text-xs text-muted-foreground">{CACHE_NOTE}</p>
      </div>
      <LinkSettings share={share} onChange={onChange} canRegenerate={canRegenerate} />
    </div>
  );
}

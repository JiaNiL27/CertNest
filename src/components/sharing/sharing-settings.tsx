"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/certnest/copy-button";
import {
  disableShareAction,
  enablePortfolioAction,
  updateDisplayNameAction,
  type ShareView,
} from "@/app/(app)/settings/sharing/actions";
import { ShareLinkControls } from "./share-link-controls";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border p-6">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DisplayNameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateDisplayNameAction(value);
          setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.error });
          if (result.ok) router.refresh();
        });
      }}
    >
      <Label htmlFor="display_name">Display name</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="display_name"
          value={value}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Shown at the top of your public pages. Your email is never shown.
      </p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-primary" : "text-destructive"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

function PortfolioSection({ initial }: { initial: ShareView | null }) {
  const [share, setShare] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Section
      title="Public portfolio"
      description="One read-only page with all your badges, except the ones you hide from your portfolio."
    >
      {share ? (
        <ShareLinkControls share={share} title="my badges" onChange={setShare} />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Your portfolio is off. Nobody can see it.</p>
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const result = await enablePortfolioAction();
                if (result.ok) setShare(result.data);
                else setError(result.error);
              })
            }
          >
            <Globe aria-hidden /> {pending ? "Turning on…" : "Turn on public portfolio"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </Section>
  );
}

type BadgeShare = { id: string; url: string; title: string };

function BadgeLinksSection({ initial }: { initial: BadgeShare[] }) {
  const [shares, setShares] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Section
      title="Shared badge links"
      description="Badges you've shared on their own. Turning a link off is permanent for that link."
    >
      {shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No badge links yet. Open a badge and choose Share Badge to create one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {shares.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{s.url}</p>
              </div>
              <CopyButton value={s.url} label="Copy" />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(undefined);
                    const result = await disableShareAction(s.id);
                    if (result.ok) setShares((list) => list.filter((x) => x.id !== s.id));
                    else setError(result.error);
                  })
                }
              >
                Turn off
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </Section>
  );
}

export function SharingSettings({
  displayName,
  portfolio,
  badgeShares,
}: {
  displayName: string;
  portfolio: ShareView | null;
  badgeShares: BadgeShare[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Profile" description="How you appear to people you share with.">
        <DisplayNameForm initial={displayName} />
      </Section>
      <PortfolioSection initial={portfolio} />
      <BadgeLinksSection initial={badgeShares} />
    </div>
  );
}

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
  updateHandleAction,
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

// One portfolio, one link: the custom address when set, otherwise the random
// link. Setting an address turns the random link off; removing the address
// issues a new random link (the DB trigger does both).
function PortfolioSection({
  initial,
  initialHandle,
  siteUrl,
}: {
  initial: ShareView | null;
  initialHandle: string | null;
  siteUrl: string;
}) {
  const [share, setShare] = useState(initial);
  const [handle, setHandle] = useState(initialHandle);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const shown = share && handle ? { ...share, url: `${siteUrl}/u/${handle}` } : share;

  return (
    <Section
      title="Public portfolio"
      description="One read-only page with all your badges, except the ones you hide from your portfolio."
    >
      {shown ? (
        <>
          <p className="text-sm font-medium">Your link</p>
          <ShareLinkControls share={shown} title="my badges" onChange={setShare} canRegenerate={!handle} />
        </>
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
      <CustomAddressForm
        saved={handle}
        siteUrl={siteUrl}
        onSaved={(next, portfolio) => {
          setHandle(next);
          setShare(portfolio);
        }}
      />
    </Section>
  );
}

// Optional, readable /u/{handle} address that replaces the random link.
function CustomAddressForm({
  saved,
  siteUrl,
  onSaved,
}: {
  saved: string | null;
  siteUrl: string;
  onSaved: (handle: string | null, portfolio: ShareView | null) => void;
}) {
  const [value, setValue] = useState(saved ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const prefix = `${siteUrl.replace(/^https?:\/\//, "")}/u/`;

  function save(next: string | null) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await updateHandleAction(next);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      onSaved(result.data.handle, result.data.portfolio);
      setValue(result.data.handle ?? "");
      setMessage({
        ok: true,
        text: result.data.handle ? "Address saved." : "Custom address removed. You have a new random link.",
      });
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div>
        <h3 className="font-sans text-base font-semibold">Custom address (optional)</h3>
        <p className="text-sm text-muted-foreground">
          A short, readable address, like on a resume. It replaces your random link, which stops
          working. If you remove it, you get a new random link.
        </p>
      </div>
      <p className="rounded-lg bg-muted p-3 text-sm">
        Anyone who knows or guesses this address can see your portfolio while it’s on. If you
        change or remove it, the old address stays reserved for you for 90 days.
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save(value);
        }}
      >
        <Label htmlFor="handle">Address</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-lg border focus-within:ring-3 focus-within:ring-ring/50 sm:max-w-md">
            <span className="hidden shrink-0 pl-3 text-sm text-muted-foreground sm:inline">{prefix}</span>
            <input
              id="handle"
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              maxLength={30}
              autoComplete="off"
              spellCheck={false}
              placeholder="your-name"
              aria-describedby="handle-hint"
              className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            />
          </div>
          <Button type="submit" disabled={pending || !value.trim() || value === saved}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {saved && (
            <Button type="button" variant="outline" disabled={pending} onClick={() => save(null)}>
              Remove
            </Button>
          )}
        </div>
        <p id="handle-hint" className="text-xs text-muted-foreground">
          3–30 characters: lowercase letters, numbers and hyphens.
        </p>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-primary" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
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
  handle,
  siteUrl,
}: {
  displayName: string;
  portfolio: ShareView | null;
  badgeShares: BadgeShare[];
  handle: string | null;
  siteUrl: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Profile" description="How you appear to people you share with.">
        <DisplayNameForm initial={displayName} />
      </Section>
      <PortfolioSection initial={portfolio} initialHandle={handle} siteUrl={siteUrl} />
      <BadgeLinksSection initial={badgeShares} />
    </div>
  );
}

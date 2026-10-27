import { BadgeIcon } from "@/components/certnest/badge-icon";
import { ExpandableText } from "@/components/certnest/expandable-text";
import { StatusBadges } from "@/components/certnest/status-badges";
import { expirationState } from "@/lib/certificates/display";
import { formatDate } from "@/lib/format";
import type { PublicCertificate } from "@/lib/sharing/public";

// Public, read-only badge view. Only renders fields returned by the public
// functions; there is no download, edit or owner information here. Unlike
// the owner's view, empty sections are left out instead of "Not provided",
// and there is no issuer link or "Issuer link available" tag (owner's choice,
// 2026-10-28).
export function PublicBadgeDetail({
  certificate: c,
  earnedBy,
  imageSrc,
  today,
}: {
  certificate: PublicCertificate;
  earnedBy: string;
  imageSrc: string | null;
  today: string;
}) {
  return (
    <article className="grid gap-8 md:grid-cols-[18rem_1fr] md:gap-10">
      <div className="flex justify-center md:justify-start">
        <BadgeIcon
          issuer={c.issuer_name}
          imageSrc={imageSrc}
          className="size-44 sm:size-64 md:size-72 [&>div]:text-6xl sm:[&>div]:text-7xl"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl leading-tight font-semibold break-words sm:text-4xl">{c.title}</h1>
          <p className="text-muted-foreground">
            Issued by <span className="font-medium text-foreground">{c.issuer_name}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Earned by <span className="font-medium text-foreground">{earnedBy}</span>
            {c.issued_at && <> · Issued {formatDate(c.issued_at)}</>}
          </p>
          <StatusBadges state={expirationState(c, today)} issuerLink={false} className="mt-1" />
        </header>

        {c.description && <ExpandableText text={c.description} />}

        {c.skills.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-base font-semibold">Skills</h2>
            <ul className="flex flex-wrap gap-2">
              {c.skills.map((s) => (
                <li key={s} className="rounded-md border border-primary/25 px-3 py-1.5 text-sm text-primary">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Only present when the earner chose to show it. */}
        {c.credential_id && (
          <p className="text-sm text-muted-foreground">
            Credential ID: <span className="font-mono break-all text-foreground">{c.credential_id}</span>
          </p>
        )}
      </div>
    </article>
  );
}

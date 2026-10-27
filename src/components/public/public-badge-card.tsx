import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { BadgeIcon } from "@/components/certnest/badge-icon";
import { StatusBadges } from "@/components/certnest/status-badges";
import { expirationState } from "@/lib/certificates/display";
import { formatMonthYear } from "@/lib/format";
import type { PublicCertificate } from "@/lib/sharing/public";
import type { PortfolioPaths } from "@/lib/sharing/urls";

// Visitor's badge card. Links only to the public detail page.
export function PublicBadgeCard({
  certificate: c,
  paths,
  today,
}: {
  certificate: PublicCertificate;
  paths: PortfolioPaths;
  today: string;
}) {
  const href = `${paths.badgeBase}/${c.public_id}`;
  const state = expirationState(c, today);

  return (
    <article className="group flex flex-col items-center gap-4 rounded-2xl border bg-card p-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <Link href={href} tabIndex={-1} aria-hidden className="transition-transform duration-200 group-hover:scale-[1.03]">
        <BadgeIcon
          issuer={c.issuer_name}
          imageSrc={c.image_key ? `${paths.imageBase}/${c.image_key}` : null}
          className="size-32 [&>div]:text-5xl"
        />
      </Link>
      <div className="flex flex-col gap-1">
        <h3 className="text-xl leading-snug font-semibold">
          <Link href={href} className="hover:underline hover:underline-offset-4">
            {c.title}
          </Link>
        </h3>
        <p className="text-muted-foreground">{c.issuer_name}</p>
        {c.issued_at && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            Issued {formatMonthYear(c.issued_at)}
          </p>
        )}
      </div>
      {/* Issuer link chip is shown on the detail page instead. */}
      <StatusBadges state={state} issuerLink={false} className="justify-center" />
      <div className="mt-auto w-full border-t pt-4">
        <Link
          href={href}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          View credential <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

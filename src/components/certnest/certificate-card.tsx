import { CalendarDays } from "lucide-react";
import type { CertificateSummary } from "@/lib/certificates/queries";
import { expirationState, hasIssuerLink } from "@/lib/certificates/display";
import { formatMonthYear } from "@/lib/format";
import { BadgeIcon } from "./badge-icon";
import { CardMenu } from "./card-menu";
import { OpenDetails } from "./details-dialog";
import { StatusBadges } from "./status-badges";

// Clicking the card opens Badge Details; edit and delete live in the menu.
// `today` (YYYY-MM-DD, UTC) comes from the server.
export function CertificateCard({
  certificate,
  today,
}: {
  certificate: CertificateSummary;
  today: string;
}) {
  const { id, title, issuer_name, issued_at, badgeFileId } = certificate;

  return (
    <article className="relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <BadgeIcon issuer={issuer_name} badgeFileId={badgeFileId} />
        {/* Above the stretched button so the menu stays clickable. */}
        <div className="relative z-10">
          <CardMenu certificateId={id} title={title} />
        </div>
      </div>
      <StatusBadges
        state={expirationState(certificate, today)}
        issuerLink={hasIssuerLink(certificate)}
      />
      <div className="flex flex-col gap-1">
        <h3 className="text-lg leading-snug font-semibold">
          <OpenDetails certificateId={id} title={title} />
        </h3>
        <p className="text-sm text-muted-foreground">{issuer_name}</p>
        {issued_at && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            Issued {formatMonthYear(issued_at)}
          </p>
        )}
      </div>
    </article>
  );
}

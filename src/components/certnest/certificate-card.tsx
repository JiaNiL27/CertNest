import { CalendarDays } from "lucide-react";
import type { CertificateSummary } from "@/lib/certificates/queries";
import { formatMonthYear } from "@/lib/format";
import { BadgeIcon } from "./badge-icon";
import { CardMenu } from "./card-menu";

// Clicking the card opens nothing yet; Badge Details arrive in M3.
// Edit and delete live in the card menu.
export function CertificateCard({ certificate }: { certificate: CertificateSummary }) {
  const { id, title, issuer_name, issued_at, badgeFileId } = certificate;

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <BadgeIcon issuer={issuer_name} badgeFileId={badgeFileId} />
        <CardMenu certificateId={id} title={title} />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg leading-snug font-semibold">{title}</h3>
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

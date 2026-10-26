import { Download, EyeOff, ExternalLink } from "lucide-react";
import type { CertificateDetail } from "@/lib/certificates/queries";
import {
  NOT_PROVIDED,
  expirationDateText,
  expirationState,
  hasIssuerLink,
} from "@/lib/certificates/display";
import { formatDate, formatFileSize } from "@/lib/format";
import { BadgeIcon, ownerImageSrc } from "./badge-icon";
import { CopyButton } from "./copy-button";
import { ExpandableText } from "./expandable-text";
import { StatusBadges } from "./status-badges";

function Missing() {
  return <span className="text-muted-foreground italic">{NOT_PROVIDED}</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

// Owner's view of a certificate. All user data is rendered as plain text.
// `today` (YYYY-MM-DD, UTC) comes from the server so status is consistent.
export function BadgeDetails({
  certificate: c,
  today,
  actions,
  titleAs: Title = "h1",
}: {
  certificate: CertificateDetail;
  today: string;
  actions?: React.ReactNode;
  titleAs?: "h1" | "h2" | "h3";
}) {
  const state = expirationState(c, today);
  const issuerLink = hasIssuerLink(c);

  return (
    <article className="grid gap-8 md:grid-cols-[13rem_1fr]">
      <div className="flex justify-center md:justify-start">
        <BadgeIcon
          issuer={c.issuer_name}
          imageSrc={ownerImageSrc(c.badge?.id ?? null)}
          className="size-48 md:size-52 [&>div]:text-6xl"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-2">
          <Title className="text-3xl leading-tight font-semibold">{c.title}</Title>
          <p className="text-muted-foreground">
            Issued by <span className="font-medium text-foreground">{c.issuer_name}</span>
          </p>
          <StatusBadges state={state} issuerLink={issuerLink} className="mt-1" />
        </header>

        {c.description ? (
          <ExpandableText text={c.description} />
        ) : (
          <p>
            <span className="text-sm text-muted-foreground">Description: </span>
            <Missing />
          </p>
        )}

        {issuerLink && (
          <a
            href={c.credential_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 font-medium text-primary underline underline-offset-4"
          >
            View on issuer site <ExternalLink className="size-4" aria-hidden />
          </a>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="font-sans text-sm font-semibold">Skills</h3>
          {c.skills.length ? (
            <ul className="flex flex-wrap gap-2">
              {[...c.skills].sort((a, b) => a.localeCompare(b)).map((s) => (
                <li key={s} className="rounded-md border border-primary/25 px-3 py-1.5 text-sm text-primary">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <Missing />
          )}
        </section>

        <dl className="rounded-xl border px-4">
          <Row label="Platform">{c.source_platform ?? <Missing />}</Row>
          <Row label="Issue date">{c.issued_at ? formatDate(c.issued_at) : <Missing />}</Row>
          <Row label="Expiration date">
            <span className={state.kind === "unknown" ? "text-muted-foreground italic" : undefined}>
              {expirationDateText(state)}
            </span>
          </Row>
          <Row label="Credential ID">
            {c.credential_id ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm break-all">{c.credential_id}</span>
                <CopyButton value={c.credential_id} label="Copy" />
              </span>
            ) : (
              <Missing />
            )}
          </Row>
          <Row label="Credential URL">
            {issuerLink ? (
              <a
                href={c.credential_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary underline underline-offset-4"
              >
                {c.credential_url}
              </a>
            ) : (
              <Missing />
            )}
          </Row>
          <Row label="Original file">
            {c.original ? (
              <a
                href={`/api/files?id=${c.original.id}`}
                className="inline-flex items-center gap-1.5 text-primary underline underline-offset-4"
              >
                <Download className="size-4" aria-hidden />
                {c.original.file_name}
                <span className="text-muted-foreground no-underline">
                  ({formatFileSize(c.original.file_size)})
                </span>
              </a>
            ) : (
              <Missing />
            )}
          </Row>
        </dl>

        {c.hidden_from_portfolio && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <EyeOff className="size-4" aria-hidden /> Hidden from your public portfolio
          </p>
        )}

        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </article>
  );
}

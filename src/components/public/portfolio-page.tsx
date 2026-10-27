import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { todayUtc } from "@/lib/certificates/display";
import { initials } from "@/lib/format";
import type { PublicCertificate, PublicPortfolio } from "@/lib/sharing/public";
import type { PortfolioPaths } from "@/lib/sharing/urls";
import { PortfolioView } from "./portfolio-view";
import { PublicBadgeDetail } from "./public-badge-detail";
import { PublicShell } from "./public-shell";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Visitor portfolio, shared by /p/{slug} and /u/{handle} (and their /skills).
export function PortfolioPage({
  portfolio,
  paths,
  tab,
}: {
  portfolio: PublicPortfolio;
  paths: PortfolioPaths;
  tab: "badges" | "skills";
}) {
  const { display_name, certificates } = portfolio;
  const skillCount = new Set(certificates.flatMap((c) => c.skills)).size;
  const organizationCount = new Set(certificates.map((c) => c.issuer_name)).size;

  return (
    <PublicShell sharedBy={display_name}>
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-br from-secondary via-muted to-background"
        />
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-80 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center justify-center gap-5 px-4 py-10 text-center sm:flex-row sm:gap-8 sm:py-14 sm:text-left">
          <div
            aria-hidden
            className="grid size-20 shrink-0 place-items-center rounded-full bg-background font-heading text-4xl text-primary shadow-sm ring-8 ring-primary/10 sm:size-28 sm:text-5xl"
          >
            {initials(display_name)}
          </div>
          <div className="flex min-w-0 max-w-full flex-col items-center gap-2 sm:items-start">
            <h1 className="max-w-full text-3xl font-semibold break-words sm:text-5xl">{display_name}</h1>
            {/* Stats wrap as whole items on narrow screens. */}
            <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-base text-muted-foreground sm:justify-start sm:text-lg">
              {[
                plural(certificates.length, "badge"),
                plural(skillCount, "skill"),
                plural(organizationCount, "organization"),
              ].map((stat, i) => (
                <li key={stat} className="flex items-center gap-3 whitespace-nowrap">
                  {i > 0 && <span aria-hidden>·</span>}
                  {stat}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <PortfolioView paths={paths} initialTab={tab} certificates={certificates} today={todayUtc()} />
    </PublicShell>
  );
}

// One badge from a portfolio, shared by /p/{slug}/{id} and /u/{handle}/badges/{id}.
export function PortfolioBadgePage({
  portfolio,
  certificate: c,
  paths,
}: {
  portfolio: PublicPortfolio;
  certificate: PublicCertificate;
  paths: PortfolioPaths;
}) {
  return (
    <PublicShell sharedBy={portfolio.display_name}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <Link href={paths.home} className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft className="size-4" aria-hidden /> All badges from {portfolio.display_name}
        </Link>
        <PublicBadgeDetail
          certificate={c}
          earnedBy={portfolio.display_name}
          imageSrc={c.image_key ? `${paths.imageBase}/${c.image_key}` : null}
          today={todayUtc()}
        />
      </div>
    </PublicShell>
  );
}

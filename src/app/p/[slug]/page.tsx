import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PortfolioView } from "@/components/public/portfolio-view";
import { PublicShell } from "@/components/public/public-shell";
import { todayUtc } from "@/lib/certificates/display";
import { initials } from "@/lib/format";
import { INVALID_LINK_METADATA, shareMetadata } from "@/lib/sharing/metadata";
import { getPublicPortfolio } from "@/lib/sharing/public";
import { portfolioPath } from "@/lib/sharing/urls";

// Render fully before responding; the proxy already returns 404 for invalid
// links. Every request re-checks the share, so a revoked link stops at once.
export const instant = false;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function generateMetadata({ params }: PageProps<"/p/[slug]">) {
  await connection();
  const { slug } = await params;
  const portfolio = await getPublicPortfolio(slug);
  if (!portfolio) return INVALID_LINK_METADATA;
  const skills = new Set(portfolio.certificates.flatMap((c) => c.skills)).size;
  return shareMetadata({
    title: `${portfolio.display_name}'s badges`,
    description: `${plural(portfolio.certificates.length, "badge")} · ${plural(skills, "skill")} on CertNest`,
    path: portfolioPath(slug),
    imagePath: `${portfolioPath(slug)}/og`,
  });
}

export default async function PortfolioPage({ params }: PageProps<"/p/[slug]">) {
  await connection();
  const { slug } = await params;
  const portfolio = await getPublicPortfolio(slug);
  if (!portfolio) notFound();

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
        <div className="relative mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 px-4 py-14 text-center sm:flex-row sm:gap-8 sm:text-left">
          <div
            aria-hidden
            className="grid size-28 shrink-0 place-items-center rounded-full bg-background font-heading text-5xl text-primary shadow-sm ring-8 ring-primary/10"
          >
            {initials(display_name)}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
            <h1 className="text-4xl font-semibold sm:text-5xl">{display_name}</h1>
            <p className="text-lg text-muted-foreground">
              {plural(certificates.length, "badge")} · {plural(skillCount, "skill")} ·{" "}
              {plural(organizationCount, "organization")}
            </p>
          </div>
        </div>
      </section>

      <PortfolioView slug={slug} certificates={certificates} today={todayUtc()} />
    </PublicShell>
  );
}

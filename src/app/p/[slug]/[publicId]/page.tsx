import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { PublicBadgeDetail } from "@/components/public/public-badge-detail";
import { PublicShell } from "@/components/public/public-shell";
import { todayUtc } from "@/lib/certificates/display";
import { INVALID_LINK_METADATA, shareMetadata } from "@/lib/sharing/metadata";
import { getPublicPortfolio } from "@/lib/sharing/public";
import { portfolioBadgePath, portfolioPath, publicImagePath } from "@/lib/sharing/urls";

export const instant = false;

// The badge must belong to this (active) portfolio; revoking the portfolio
// link therefore also disables these URLs.
async function load(params: PageProps<"/p/[slug]/[publicId]">["params"]) {
  await connection();
  const { slug, publicId } = await params;
  const portfolio = await getPublicPortfolio(slug);
  const certificate = portfolio?.certificates.find((c) => c.public_id === publicId);
  return portfolio && certificate ? { slug, portfolio, certificate } : null;
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]/[publicId]">) {
  const data = await load(params);
  if (!data) return INVALID_LINK_METADATA;
  const { slug, portfolio, certificate: c } = data;
  return shareMetadata({
    title: c.title,
    description: `Issued by ${c.issuer_name} · earned by ${portfolio.display_name}`,
    path: portfolioBadgePath(slug, c.public_id),
    imagePath: c.image_key ? publicImagePath("p", slug, c.image_key) : null,
  });
}

export default async function PortfolioBadgePage({ params }: PageProps<"/p/[slug]/[publicId]">) {
  const data = await load(params);
  if (!data) notFound();
  const { slug, portfolio, certificate: c } = data;

  return (
    <PublicShell sharedBy={portfolio.display_name}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <Link
          href={portfolioPath(slug)}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden /> All badges from {portfolio.display_name}
        </Link>
        <PublicBadgeDetail
          certificate={c}
          earnedBy={portfolio.display_name}
          imageSrc={c.image_key ? publicImagePath("p", slug, c.image_key) : null}
          today={todayUtc()}
        />
      </div>
    </PublicShell>
  );
}

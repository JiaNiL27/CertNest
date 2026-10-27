import "server-only";
import { connection } from "next/server";
import { INVALID_LINK_METADATA, shareMetadata } from "./metadata";
import { getPublicPortfolio, getPublicPortfolioByHandle, type PublicPortfolio } from "./public";
import { portfolioPaths, type PortfolioPaths } from "./urls";

// A public portfolio is reached either by its random link (/p/{slug}) or by
// the owner's custom address (/u/{handle}). Both read the same whitelisted
// data; pages only differ in their paths.

export type PortfolioSource = { kind: "slug"; slug: string } | { kind: "handle"; handle: string };

export async function loadPortfolio(
  source: PortfolioSource,
): Promise<{ portfolio: PublicPortfolio; paths: PortfolioPaths } | null> {
  // Per request: a turned-off portfolio stops working immediately.
  await connection();
  const portfolio =
    source.kind === "slug"
      ? await getPublicPortfolio(source.slug)
      : await getPublicPortfolioByHandle(source.handle);
  return portfolio ? { portfolio, paths: portfolioPaths(source) } : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function portfolioMetadata(source: PortfolioSource, tab: "badges" | "skills") {
  const data = await loadPortfolio(source);
  if (!data) return INVALID_LINK_METADATA;
  const { portfolio, paths } = data;
  const skills = new Set(portfolio.certificates.flatMap((c) => c.skills)).size;
  return shareMetadata({
    title: tab === "skills" ? `${portfolio.display_name}'s skills` : `${portfolio.display_name}'s badges`,
    description: `${plural(portfolio.certificates.length, "badge")} · ${plural(skills, "skill")} on CertNest`,
    path: tab === "skills" ? paths.skills : paths.home,
    imagePath: paths.og,
  });
}

export async function loadPortfolioBadge(source: PortfolioSource, publicId: string) {
  const data = await loadPortfolio(source);
  const certificate = data?.portfolio.certificates.find((c) => c.public_id === publicId);
  return data && certificate ? { ...data, certificate } : null;
}

export async function portfolioBadgeMetadata(source: PortfolioSource, publicId: string) {
  const data = await loadPortfolioBadge(source, publicId);
  if (!data) return INVALID_LINK_METADATA;
  const { portfolio, paths, certificate: c } = data;
  return shareMetadata({
    title: c.title,
    description: `Issued by ${c.issuer_name} · earned by ${portfolio.display_name}`,
    path: `${paths.badgeBase}/${c.public_id}`,
    imagePath: c.image_key ? `${paths.imageBase}/${c.image_key}` : null,
  });
}

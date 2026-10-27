import { notFound } from "next/navigation";
import { PortfolioPage } from "@/components/public/portfolio-page";
import { loadPortfolio, portfolioMetadata } from "@/lib/sharing/portfolio-source";

// Render fully before responding; the proxy already returns 404 for invalid
// links. Every request re-checks the share, so a turned-off portfolio stops
// working at once.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/p/[slug]/skills">) {
  const { slug } = await params;
  return portfolioMetadata({ kind: "slug", slug }, "skills");
}

export default async function Page({ params }: PageProps<"/p/[slug]/skills">) {
  const { slug } = await params;
  const data = await loadPortfolio({ kind: "slug", slug });
  if (!data) notFound();
  return <PortfolioPage portfolio={data.portfolio} paths={data.paths} tab="skills" />;
}

import { notFound } from "next/navigation";
import { PortfolioPage } from "@/components/public/portfolio-page";
import { loadPortfolio, portfolioMetadata } from "@/lib/sharing/portfolio-source";

// Render fully before responding; the proxy already returns 404 for invalid
// links. Every request re-checks the share, so a turned-off portfolio stops
// working at once.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/u/[handle]/skills">) {
  const { handle } = await params;
  return portfolioMetadata({ kind: "handle", handle }, "skills");
}

export default async function Page({ params }: PageProps<"/u/[handle]/skills">) {
  const { handle } = await params;
  const data = await loadPortfolio({ kind: "handle", handle });
  if (!data) notFound();
  return <PortfolioPage portfolio={data.portfolio} paths={data.paths} tab="skills" />;
}

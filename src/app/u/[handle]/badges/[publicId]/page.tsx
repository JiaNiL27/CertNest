import { notFound } from "next/navigation";
import { PortfolioBadgePage } from "@/components/public/portfolio-page";
import { loadPortfolioBadge, portfolioBadgeMetadata } from "@/lib/sharing/portfolio-source";

// Render fully before responding; the proxy already returns 404 for invalid
// links. Every request re-checks the share, so a turned-off portfolio stops
// working at once.
export const instant = false;

// The badge must belong to this (active) portfolio, so turning the portfolio
// off disables these URLs too.
export async function generateMetadata({ params }: PageProps<"/u/[handle]/badges/[publicId]">) {
  const { handle, publicId } = await params;
  return portfolioBadgeMetadata({ kind: "handle", handle }, publicId);
}

export default async function Page({ params }: PageProps<"/u/[handle]/badges/[publicId]">) {
  const { handle, publicId } = await params;
  const data = await loadPortfolioBadge({ kind: "handle", handle }, publicId);
  if (!data) notFound();
  return (
    <PortfolioBadgePage portfolio={data.portfolio} certificate={data.certificate} paths={data.paths} />
  );
}

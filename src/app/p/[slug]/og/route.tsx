import { loadPortfolio } from "@/lib/sharing/portfolio-source";
import { portfolioOgImage } from "@/lib/sharing/og-image";

export async function GET(_: Request, { params }: RouteContext<"/p/[slug]/og">) {
  const { slug } = await params;
  const data = await loadPortfolio({ kind: "slug", slug });
  if (!data) return new Response("Not found", { status: 404 });
  return portfolioOgImage(data.portfolio);
}

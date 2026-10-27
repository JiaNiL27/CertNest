import { loadPortfolio } from "@/lib/sharing/portfolio-source";
import { portfolioOgImage } from "@/lib/sharing/og-image";

export async function GET(_: Request, { params }: RouteContext<"/u/[handle]/og">) {
  const { handle } = await params;
  const data = await loadPortfolio({ kind: "handle", handle });
  if (!data) return new Response("Not found", { status: 404 });
  return portfolioOgImage(data.portfolio);
}

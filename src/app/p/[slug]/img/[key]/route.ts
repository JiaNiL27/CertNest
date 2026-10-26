import { connection } from "next/server";
import { servePublicImage } from "@/lib/sharing/image";

// Never cached: a revoked link stops working on the next request.
export async function GET(_: Request, { params }: RouteContext<"/p/[slug]/img/[key]">) {
  await connection();
  const { slug, key } = await params;
  return servePublicImage(slug, key);
}

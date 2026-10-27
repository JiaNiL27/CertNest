import { connection } from "next/server";
import { servePublicImageByHandle } from "@/lib/sharing/image";

// Never cached: turning the portfolio off stops images on the next request.
export async function GET(_: Request, { params }: RouteContext<"/u/[handle]/img/[key]">) {
  await connection();
  const { handle, key } = await params;
  return servePublicImageByHandle(handle, key);
}

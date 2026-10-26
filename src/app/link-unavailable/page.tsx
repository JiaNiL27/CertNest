import { notFound } from "next/navigation";
import { INVALID_LINK_METADATA } from "@/lib/sharing/metadata";

// Target of the proxy rewrite for invalid public links. Calling notFound()
// while prerendering makes this a static page served with HTTP 404.
export const metadata = INVALID_LINK_METADATA;

export default function LinkUnavailablePage() {
  notFound();
}

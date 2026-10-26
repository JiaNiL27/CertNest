import "server-only";
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Public pages are shareable but never indexed by search engines.
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };

export const INVALID_LINK_METADATA: Metadata = {
  title: "Link not available · CertNest",
  robots: NO_INDEX,
};

/** Open Graph / Twitter tags for link previews on social platforms. */
export function shareMetadata(opts: {
  title: string;
  description: string;
  path: string;
  imagePath: string | null;
}): Metadata {
  const images = opts.imagePath ? [{ url: opts.imagePath }] : undefined;
  return {
    metadataBase: new URL(getSiteUrl()),
    title: `${opts.title} · CertNest`,
    description: opts.description,
    robots: NO_INDEX,
    openGraph: {
      type: "website",
      siteName: "CertNest",
      title: opts.title,
      description: opts.description,
      url: opts.path,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: opts.title,
      description: opts.description,
      images: opts.imagePath ? [opts.imagePath] : undefined,
    },
  };
}

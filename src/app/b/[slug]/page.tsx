import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicBadgeDetail } from "@/components/public/public-badge-detail";
import { PublicShell } from "@/components/public/public-shell";
import { todayUtc } from "@/lib/certificates/display";
import { INVALID_LINK_METADATA, shareMetadata } from "@/lib/sharing/metadata";
import { getPublicBadge } from "@/lib/sharing/public";
import { badgePath, publicImagePath } from "@/lib/sharing/urls";

// Render fully before responding so an invalid link returns HTTP 404.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/b/[slug]">) {
  await connection();
  const { slug } = await params;
  const badge = await getPublicBadge(slug);
  if (!badge) return INVALID_LINK_METADATA;
  const c = badge.certificate;
  return shareMetadata({
    title: c.title,
    description: `Issued by ${c.issuer_name} · earned by ${badge.display_name}`,
    path: badgePath(slug),
    imagePath: c.image_key ? publicImagePath("b", slug, c.image_key) : null,
  });
}

export default async function SharedBadgePage({ params }: PageProps<"/b/[slug]">) {
  await connection();
  const { slug } = await params;
  const badge = await getPublicBadge(slug);
  if (!badge) notFound();
  const c = badge.certificate;

  return (
    <PublicShell sharedBy={badge.display_name}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <PublicBadgeDetail
          certificate={c}
          earnedBy={badge.display_name}
          imageSrc={c.image_key ? publicImagePath("b", slug, c.image_key) : null}
          today={todayUtc()}
        />
      </div>
    </PublicShell>
  );
}

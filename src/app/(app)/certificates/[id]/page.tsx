import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BadgeDetails } from "@/components/certnest/badge-details";
import { ShareBadgePanel } from "@/components/sharing/share-badge-panel";
import { AiPostPanel } from "@/components/ai/ai-post-panel";
import { todayUtc } from "@/lib/certificates/display";
import { getCertificate } from "@/lib/certificates/queries";
import { createClient } from "@/lib/supabase/server";
import { loadAiPanelState } from "@/lib/ai/panel-state";
import { loadShareBadgeState } from "@/lib/sharing/badge-state";
import { DetailSkeleton } from "@/components/certnest/skeletons";

export const metadata = { title: "Badge details · CertNest" };

async function Details({ params }: Pick<PageProps<"/certificates/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();
  // Missing and not-owned both 404.
  const certificate = await getCertificate(supabase, id);
  if (!certificate) notFound();

  // Load the panels' data here, with the same client, instead of from the
  // browser on mount.
  const [shareState, aiState] = await Promise.all([
    loadShareBadgeState(supabase, certificate),
    loadAiPanelState(supabase, certificate),
  ]);

  return (
    <>
      <BadgeDetails
        certificate={certificate}
        today={todayUtc()}
        actions={
          <Link href={`/certificates/${certificate.id}/edit`} className={buttonVariants({ size: "lg" })}>
            <Pencil aria-hidden /> Edit
          </Link>
        }
      />
      <section className="flex flex-col gap-4 rounded-xl border p-6">
        <div>
          <h2 className="text-2xl font-semibold">LinkedIn post</h2>
          <p className="text-muted-foreground">Draft a post about this badge with AI, then edit it.</p>
        </div>
        <AiPostPanel certificateId={certificate.id} initial={aiState} />
      </section>
      <div className="rounded-xl border p-6">
        <ShareBadgePanel certificateId={certificate.id} initial={shareState} initialAi={aiState} />
      </div>
    </>
  );
}

export default function CertificatePage({ params }: PageProps<"/certificates/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <Link
        href="/certificates"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to my certificates
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <Details params={params} />
      </Suspense>
    </main>
  );
}

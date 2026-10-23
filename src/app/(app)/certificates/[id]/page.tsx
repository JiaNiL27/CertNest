import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BadgeDetails } from "@/components/certnest/badge-details";
import { todayUtc } from "@/lib/certificates/display";
import { getCertificate } from "@/lib/certificates/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Badge details · CertNest" };

async function Details({ params }: Pick<PageProps<"/certificates/[id]">, "params">) {
  const { id } = await params;
  const supabase = await createClient();
  // Missing and not-owned both 404.
  const certificate = await getCertificate(supabase, id);
  if (!certificate) notFound();

  return (
    <BadgeDetails
      certificate={certificate}
      today={todayUtc()}
      actions={
        <Link href={`/certificates/${certificate.id}/edit`} className={buttonVariants({ size: "lg" })}>
          <Pencil aria-hidden /> Edit
        </Link>
      }
    />
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
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Details params={params} />
      </Suspense>
    </main>
  );
}

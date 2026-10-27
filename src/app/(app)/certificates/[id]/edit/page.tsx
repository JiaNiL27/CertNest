import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CertificateForm } from "@/components/certnest/certificate-form";
import { getCertificate } from "@/lib/certificates/queries";
import { createClient } from "@/lib/supabase/server";
import { FormSkeleton } from "@/components/certnest/skeletons";

export const metadata = { title: "Edit certificate · CertNest" };

async function EditForm({
  params,
  searchParams,
}: Pick<PageProps<"/certificates/[id]/edit">, "params" | "searchParams">) {
  const [{ id }, { upload }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  // Missing and not-owned both 404.
  const certificate = await getCertificate(supabase, id);
  if (!certificate) notFound();

  return (
    <>
      {upload === "failed" && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          Your certificate was saved, but the file upload failed. Please choose the file again.
        </p>
      )}
      <CertificateForm certificate={certificate} />
    </>
  );
}

export default function EditCertificatePage({
  params,
  searchParams,
}: PageProps<"/certificates/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Edit certificate</h1>
      <Suspense fallback={<FormSkeleton />}>
        <EditForm params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

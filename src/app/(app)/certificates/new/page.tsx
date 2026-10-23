import { CertificateForm } from "@/components/certnest/certificate-form";

export const metadata = { title: "Add certificate · CertNest" };

export default function NewCertificatePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Add a certificate</h1>
      <CertificateForm />
    </main>
  );
}

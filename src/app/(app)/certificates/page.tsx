import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CertificateCard } from "@/components/certnest/certificate-card";
import {
  SORT_OPTIONS,
  listCertificates,
  listIssuers,
  type SortOption,
} from "@/lib/certificates/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My certificates · CertNest" };

type Search = { q?: string; issuer?: string; sort?: string };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Library({ searchParams }: { searchParams: PageProps<"/certificates">["searchParams"] }) {
  const raw = await searchParams;
  const params: Search = { q: first(raw.q), issuer: first(raw.issuer), sort: first(raw.sort) };
  const sort: SortOption = SORT_OPTIONS.some((o) => o.value === params.sort)
    ? (params.sort as SortOption)
    : "newest";

  const supabase = await createClient();
  const [certificates, issuers] = await Promise.all([
    listCertificates(supabase, { q: params.q, issuer: params.issuer || undefined, sort }),
    listIssuers(supabase),
  ]);
  const filtered = !!(params.q || params.issuer);

  return (
    <>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted p-4" role="search">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          Search by title
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            className="h-9 rounded-lg border bg-background px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Issuing organization
          <select
            name="issuer"
            defaultValue={params.issuer ?? ""}
            className="h-9 rounded-lg border bg-background px-2"
          >
            <option value="">All organizations</option>
            {issuers.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sort by
          <select name="sort" defaultValue={sort} className="h-9 rounded-lg border bg-background px-2">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonVariants({ size: "lg" })}>
          Apply
        </button>
        {filtered && (
          <Link href="/certificates" className={buttonVariants({ size: "lg", variant: "ghost" })}>
            Clear
          </Link>
        )}
      </form>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <p className="font-heading text-lg">
            {filtered ? "No certificates match your search." : "No certificates yet."}
          </p>
          {!filtered && (
            <Link href="/certificates/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden /> Add your first certificate
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {certificates.length} {certificates.length === 1 ? "certificate" : "certificates"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {certificates.map((c) => (
              <CertificateCard key={c.id} certificate={c} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function CertificatesPage({ searchParams }: PageProps<"/certificates">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">My certificates</h1>
        <Link href="/certificates/new" className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden /> Add certificate
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Library searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

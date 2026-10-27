import Link from "next/link";
import { Award, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/certnest/empty-state";

export const metadata = { title: "Page not found · CertNest" };

// Used for unknown URLs and for private pages whose item is missing or not
// yours (both look the same on purpose).
export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3 text-primary">
          <Award className="size-7" aria-hidden />
          <span className="ml-2 font-heading text-2xl font-semibold text-foreground">CertNest</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <EmptyState
          icon={SearchX}
          title="Page not found"
          description="This page doesn't exist, or you don't have access to it."
          action={
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Go to dashboard
            </Link>
          }
        />
      </div>
    </main>
  );
}

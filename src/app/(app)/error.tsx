"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/certnest/empty-state";

// Error boundary for signed-in pages. Shows no technical details; the digest
// is only logged so it can be matched to server logs.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const digest = (error as { digest?: string } | null)?.digest;
    console.error("[app] page error", digest ?? "");
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <EmptyState
        role="alert"
        icon={TriangleAlert}
        title="Something went wrong"
        description="We couldn't load this page. Please try again. If it keeps happening, come back in a few minutes."
        action={
          <>
            <Button size="lg" onClick={() => retry()}>
              <RotateCcw aria-hidden /> Try again
            </Button>
            <Link href="/dashboard" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Go to dashboard
            </Link>
          </>
        }
      />
    </main>
  );
}

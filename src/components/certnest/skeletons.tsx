import { Skeleton } from "@/components/ui/skeleton";

// Placeholders shaped like the real layout, shown while data loads.
// role="status" + sr-only text so screen readers announce loading once.

function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="w-full">
      <span className="sr-only">{label}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border p-5">
          <div className="flex justify-between">
            <Skeleton className="size-20 rounded-xl" />
            <Skeleton className="size-6 rounded-md" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Loading label="Loading your dashboard">
      <div className="border-b bg-muted/60">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-10">
          <Skeleton className="size-24 rounded-full" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <Skeleton className="h-10 w-56 rounded-lg" />
        <CardGridSkeleton />
      </div>
    </Loading>
  );
}

export function LibrarySkeleton() {
  return (
    <Loading label="Loading your certificates">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <CardGridSkeleton count={8} />
      </div>
    </Loading>
  );
}

export function DetailSkeleton() {
  return (
    <Loading label="Loading badge details">
      <div className="grid gap-8 md:grid-cols-[13rem_1fr]">
        <Skeleton className="mx-auto size-48 rounded-2xl md:mx-0" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-56 rounded-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </Loading>
  );
}

export function FormSkeleton() {
  return (
    <Loading label="Loading form">
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-28 w-full sm:col-span-2" />
      </div>
    </Loading>
  );
}

export function PanelSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <Loading label={label}>
      <div className="flex flex-col gap-3 py-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </Loading>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

// One look for "nothing here yet", "no results" and error screens.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  role,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="font-heading text-xl font-semibold">{title}</p>
      {description && <p className="max-w-md text-muted-foreground">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

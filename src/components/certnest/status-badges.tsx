import { CalendarClock, CircleAlert, CircleHelp, Infinity as InfinityIcon, Link2 } from "lucide-react";
import { cn } from "cn";
import { statusLabel, type ExpirationState } from "@/lib/certificates/display";

const STYLES: Record<ExpirationState["kind"], string> = {
  expires: "bg-secondary text-secondary-foreground",
  expired: "bg-destructive/10 text-destructive",
  never: "bg-secondary text-secondary-foreground",
  unknown: "bg-muted text-muted-foreground",
};

const ICONS = {
  expires: CalendarClock,
  expired: CircleAlert,
  never: InfinityIcon,
  unknown: CircleHelp,
} as const;

const chip = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium";

// Expiration status plus an optional "Issuer link available" chip.
// Never shows "Verified": certificate data is self-reported.
export function StatusBadges({
  state,
  issuerLink,
  className,
}: {
  state: ExpirationState;
  issuerLink: boolean;
  className?: string;
}) {
  const Icon = ICONS[state.kind];
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <span className={cn(chip, STYLES[state.kind])}>
        <Icon className="size-3.5" aria-hidden />
        {statusLabel(state)}
      </span>
      {issuerLink && (
        <span className={cn(chip, "border border-primary/20 text-primary")}>
          <Link2 className="size-3.5" aria-hidden />
          Issuer link available
        </span>
      )}
    </div>
  );
}

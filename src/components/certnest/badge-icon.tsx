import { cn } from "cn";
import { hueFor } from "@/lib/format";

const HEXAGON = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

// Badge image when the owner uploaded one; otherwise a hexagon with the
// issuer's initial in a color derived from the issuer name.
export function BadgeIcon({
  issuer,
  badgeFileId,
  className,
}: {
  issuer: string;
  badgeFileId: string | null;
  className?: string;
}) {
  if (badgeFileId) {
    return (
      // Plain <img>: the owner-only route redirects to a short-lived signed URL.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files?id=${badgeFileId}&view=1`}
        alt=""
        className={cn("size-20 rounded-md object-contain", className)}
      />
    );
  }

  const hue = hueFor(issuer);
  return (
    <div
      aria-hidden
      className={cn("grid size-20 place-items-center", className)}
      style={{ clipPath: HEXAGON, background: `oklch(0.42 0.08 ${hue})` }}
    >
      <div
        className="grid size-[86%] place-items-center font-heading text-3xl font-semibold text-white"
        style={{ clipPath: HEXAGON, background: `oklch(0.52 0.1 ${hue})` }}
      >
        {issuer.trim()[0]?.toUpperCase() ?? ""}
      </div>
    </div>
  );
}

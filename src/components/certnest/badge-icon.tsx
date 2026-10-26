import { cn } from "cn";
import { hueFor } from "@/lib/format";

const HEXAGON = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

export const ownerImageSrc = (fileId: string | null) =>
  fileId ? `/api/files?id=${fileId}&view=1` : null;

// Badge image when there is one; otherwise a hexagon with the issuer's
// initial in a color derived from the issuer name. `imageSrc` is either the
// owner-only file route or a public image route.
export function BadgeIcon({
  issuer,
  imageSrc,
  className,
}: {
  issuer: string;
  imageSrc: string | null;
  className?: string;
}) {
  if (imageSrc) {
    return (
      // Plain <img>: both routes check access on every request.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
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

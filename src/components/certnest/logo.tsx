import Link from "next/link";
import { Award } from "lucide-react";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 text-primary">
      <Award className="size-7" aria-hidden />
      <span className="font-heading text-2xl font-semibold text-foreground">CertNest</span>
    </Link>
  );
}

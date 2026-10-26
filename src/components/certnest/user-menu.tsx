"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/(auth)/actions";

export function UserMenu({
  initials,
  portfolioPath,
}: {
  initials: string;
  portfolioPath: string | null;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-full p-0.5 hover:bg-muted"
      >
        <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {initials || "?"}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push("/dashboard")}>Dashboard</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/certificates")}>
          My certificates
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings/sharing")}>
          Profile & sharing
        </DropdownMenuItem>
        {portfolioPath && (
          <DropdownMenuItem
            onClick={() => window.open(portfolioPath, "_blank", "noopener,noreferrer")}
          >
            View public portfolio
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

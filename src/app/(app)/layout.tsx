import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/certnest/logo";
import { UserMenu } from "@/components/certnest/user-menu";
import { initials } from "@/lib/format";
import { getPortfolioHomePath } from "@/lib/sharing/service";
import { createClient } from "@/lib/supabase/server";

async function AccountMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data }, portfolioHome] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    getPortfolioHomePath(supabase),
  ]);
  return (
    <UserMenu
      initials={initials(data?.display_name ?? "")}
      portfolioPath={portfolioHome}
    />
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo />
          <form action="/certificates" className="relative mx-auto hidden w-full max-w-xl sm:block">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              aria-label="Search your badges"
              placeholder="Search your badges by title"
              className="h-11 w-full rounded-full border bg-background pr-4 pl-11 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </form>
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            {/* Phones: the search box doesn't fit, so link to the library search. */}
            <Link
              href="/certificates"
              aria-label="Search your badges"
              className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted sm:hidden"
            >
              <Search className="size-5" aria-hidden />
            </Link>
            <Suspense fallback={<span className="block size-9 rounded-full bg-muted" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <div id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </div>
    </>
  );
}

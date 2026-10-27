import Link from "next/link";
import { Award } from "lucide-react";

// Read-only frame for public pages. The only navigation is a sign-in link;
// nothing here leads to the owner's private pages.
export function PublicShell({
  children,
  sharedBy,
}: {
  children: React.ReactNode;
  sharedBy?: string;
}) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-primary">
            <Award className="size-7" aria-hidden />
            <span className="font-heading text-2xl font-semibold text-foreground">CertNest</span>
          </span>
          <Link href="/login" className="text-sm font-medium text-primary">
            Sign in
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <footer className="flex flex-col gap-1 border-t px-4 py-8 text-center text-xs text-muted-foreground">
        <p>
          {sharedBy && <>Credentials shared by {sharedBy} · </>}Powered by CertNest
        </p>
      </footer>
    </>
  );
}

export function InvalidLink() {
  return (
    <PublicShell>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">This link is invalid or no longer active</h1>
        <p className="text-muted-foreground">Ask the person who shared it for a new link.</p>
      </div>
    </PublicShell>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Award, Plus, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CertificateCard } from "@/components/certnest/certificate-card";
import { todayUtc } from "@/lib/certificates/display";
import { getDashboardData } from "@/lib/certificates/queries";
import { initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · CertNest" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background/80 px-5 py-3">
      <p className="font-heading text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { displayName, certificateCount, recent, skills } = await getDashboardData(
    supabase,
    user.id,
  );
  const today = todayUtc();

  return (
    <>
      <section className="border-b bg-linear-to-br from-secondary via-muted to-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-10">
          <div
            aria-hidden
            className="grid size-24 place-items-center rounded-full bg-primary/15 font-heading text-3xl text-primary"
          >
            {initials(displayName) || <Award className="size-10" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-4xl font-semibold">
              {displayName || <span className="text-muted-foreground">Display name not provided</span>}
            </h1>
            <p className="text-muted-foreground">Your certificates and skills, all in one place.</p>
          </div>
          <div className="flex gap-3">
            <Stat label={certificateCount === 1 ? "Certificate" : "Certificates"} value={certificateCount} />
            <Stat label={skills.length === 1 ? "Skill" : "Skills"} value={skills.length} />
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <Tabs defaultValue="badges" className="gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="h-10!">
              <TabsTrigger value="badges" className="px-4">
                <Award aria-hidden /> Badges
              </TabsTrigger>
              <TabsTrigger value="skills" className="px-4">
                <Sparkles aria-hidden /> Skills
              </TabsTrigger>
            </TabsList>
            <Link href="/certificates/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden /> Add certificate
            </Link>
          </div>

          <TabsContent value="badges" className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Recently added</h2>
                <p className="text-muted-foreground">Your credentials and achievements, all in one place.</p>
              </div>
              {certificateCount > 0 && (
                <Link href="/certificates" className="flex items-center gap-1 text-sm font-medium text-primary">
                  View all badges <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
                <p className="font-heading text-lg">No certificates yet.</p>
                <Link href="/certificates/new" className={buttonVariants({ size: "lg" })}>
                  <Plus aria-hidden /> Add your first certificate
                </Link>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recent.map((c) => (
                  <CertificateCard key={c.id} certificate={c} today={today} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="skills" className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Skills you’re building</h2>
              <p className="text-muted-foreground">The skills you’re developing through your certifications.</p>
            </div>
            {skills.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                No skills yet. Add skills when you add or edit a certificate.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {skills.map((s) => (
                  <li key={s.name} className="flex items-center gap-3 rounded-full bg-muted py-2 pr-5 pl-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                      <Sparkles className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.count} {s.count === 1 ? "badge" : "badges"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main>
      <Suspense
        fallback={<p className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>}
      >
        <DashboardContent />
      </Suspense>
    </main>
  );
}

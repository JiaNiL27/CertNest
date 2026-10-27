import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SharingSettings } from "@/components/sharing/sharing-settings";
import { getSiteUrl } from "@/lib/site-url";
import { getPortfolioShare, listCertificateShares } from "@/lib/sharing/service";
import { badgePath, portfolioPath } from "@/lib/sharing/urls";
import { createClient } from "@/lib/supabase/server";
import { PanelSkeleton } from "@/components/certnest/skeletons";

export const metadata = { title: "Sharing settings · CertNest" };

async function Settings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, portfolio, badgeShares] = await Promise.all([
    supabase.from("profiles").select("display_name, handle").eq("id", user.id).maybeSingle(),
    getPortfolioShare(supabase),
    listCertificateShares(supabase),
  ]);
  const site = getSiteUrl();

  return (
    <SharingSettings
      displayName={profile.data?.display_name ?? ""}
      handle={profile.data?.handle ?? null}
      siteUrl={site}
      portfolio={
        portfolio && {
          id: portfolio.id,
          url: `${site}${portfolioPath(portfolio.public_slug)}`,
          show_credential_id: portfolio.show_credential_id,
          show_images: portfolio.show_images,
        }
      }
      badgeShares={badgeShares.map((s) => ({
        id: s.id,
        title: s.title,
        url: `${site}${badgePath(s.public_slug)}`,
      }))}
    />
  );
}

export default function SharingSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Profile & sharing</h1>
      <Suspense fallback={<PanelSkeleton label="Loading your sharing settings" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

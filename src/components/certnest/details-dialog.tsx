"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ExternalLink, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShareBadgePanel } from "@/components/sharing/share-badge-panel";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getCertificateDetails } from "@/app/(app)/certificates/actions";
import type { CertificateDetail } from "@/lib/certificates/queries";
import { BadgeDetails } from "./badge-details";

type Loaded = { certificate: CertificateDetail; today: string } | null | undefined;

// Stretched title button: clicking anywhere on the card opens Badge Details in
// a dialog. The URL stays the same (owner view). Editing lives in the card
// menu; Share Badge switches the dialog to the share panel.
export function OpenDetails({ certificateId, title }: { certificateId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded>(undefined);
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"details" | "share">("details");
  const [portfolioUrl, setPortfolioUrl] = useState<string | null>(null);

  function show() {
    setView("details");
    setOpen(true);
    startTransition(async () => setData(await getCertificateDetails(certificateId)));
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
      >
        {title}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl">
          <header className="border-b px-6 py-4 pr-12">
            <DialogTitle className="font-heading text-2xl font-semibold">Badge Details</DialogTitle>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {pending || data === undefined ? (
              <p className="py-16 text-center text-muted-foreground">Loading…</p>
            ) : data === null ? (
              <p className="py-16 text-center text-muted-foreground">
                This certificate could not be found.
              </p>
            ) : view === "share" ? (
              <ShareBadgePanel certificateId={certificateId} onPortfolioUrl={setPortfolioUrl} />
            ) : (
              <BadgeDetails certificate={data.certificate} today={data.today} titleAs="h3" />
            )}
          </div>
          <footer className="flex justify-between gap-3 border-t px-6 py-4">
            {view === "share" ? (
              <Button variant="ghost" size="lg" onClick={() => setView("details")}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            ) : (
              <DialogClose render={<Button variant="ghost" size="lg" />}>Close</DialogClose>
            )}
            {view === "details" && data && (
              <Button size="lg" onClick={() => setView("share")}>
                <Share2 aria-hidden /> Share Badge
              </Button>
            )}
            {view === "share" && portfolioUrl && (
              <a
                href={portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                <ExternalLink aria-hidden /> View public portfolio
              </a>
            )}
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Award, Building2, ChevronDown, Search, SearchX, Sparkles, X } from "lucide-react";
import { cn } from "cn";
import { expirationState } from "@/lib/certificates/display";
import type { PublicCertificate } from "@/lib/sharing/public";
import { EmptyState } from "@/components/certnest/empty-state";
import { PublicBadgeCard } from "./public-badge-card";
import { SkillsWallet } from "./skills-wallet";

type Sort = "newest" | "oldest" | "title";
type Tab = "badges" | "skills";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "A–Z" },
];

function countBy(items: string[]) {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
    >
      {label} <X className="size-3.5" aria-label="Remove filter" />
    </button>
  );
}

// Visitor portfolio: centered wallet tabs, search, sort, issuer and skill
// filters. All filtering happens in the browser on already-public data.
export function PortfolioView({
  slug,
  certificates,
  today,
}: {
  slug: string;
  certificates: PublicCertificate[];
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("badges");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [issuer, setIssuer] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  const issuers = useMemo(() => countBy(certificates.map((c) => c.issuer_name)), [certificates]);
  const skills = useMemo(() => countBy(certificates.flatMap((c) => c.skills)), [certificates]);

  const { active, expired } = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Server order is newest first.
    const list = certificates
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !q || c.title.toLowerCase().includes(q))
      .filter(({ c }) => !issuer || c.issuer_name === issuer)
      .filter(({ c }) => !skill || c.skills.includes(skill));
    list.sort((a, b) =>
      sort === "title" ? a.c.title.localeCompare(b.c.title) : sort === "oldest" ? b.i - a.i : a.i - b.i,
    );
    const isExpired = (c: PublicCertificate) => expirationState(c, today).kind === "expired";
    return {
      active: list.filter(({ c }) => !isExpired(c)).map(({ c }) => c),
      expired: list.filter(({ c }) => isExpired(c)).map(({ c }) => c),
    };
  }, [certificates, query, sort, issuer, skill, today]);

  const filtered = !!(query.trim() || issuer || skill);
  const showSkill = (name: string) => {
    setSkill(name);
    setTab("badges");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      {/* Phones: two equal halves across the full width. Wider: centered pill. */}
      <div
        role="tablist"
        aria-label="Wallet"
        className="mx-auto grid w-full max-w-md grid-cols-2 rounded-full border bg-muted p-1 sm:flex sm:w-auto sm:max-w-none"
      >
        {(
          [
            ["badges", "Badge Wallet", Award, certificates.length],
            ["skills", "Skills Wallet", Sparkles, skills.length],
          ] as const
        ).map(([value, label, Icon, count]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-sm font-medium whitespace-nowrap transition-all sm:gap-2 sm:px-7",
              tab === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            <span className="rounded-full bg-secondary px-2 text-xs text-secondary-foreground">{count}</span>
          </button>
        ))}
      </div>

      {tab === "badges" ? (
        <div role="tabpanel" aria-label="Badge Wallet" className="flex flex-col gap-6">
          {issuers.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="size-4" aria-hidden /> Earned from
              </span>
              {issuers.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={issuer === name}
                  onClick={() => setIssuer(issuer === name ? null : name)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    issuer === name
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/40 hover:bg-secondary",
                  )}
                >
                  {name} <span className="opacity-70">· {count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search badges…"
                aria-label="Search badges"
                className="h-11 w-full rounded-xl border bg-background pr-4 pl-10 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <div className="flex items-center gap-1 self-end rounded-xl border p-1 sm:self-auto" role="group" aria-label="Sort">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={sort === s.value}
                  onClick={() => setSort(s.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors",
                    sort === s.value ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {(issuer || skill) && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Filtered by
              {issuer && <FilterChip label={issuer} onClear={() => setIssuer(null)} />}
              {skill && <FilterChip label={skill} onClear={() => setSkill(null)} />}
            </div>
          )}

          {active.length === 0 && expired.length === 0 ? (
            <EmptyState
              role={filtered ? "status" : undefined}
              icon={filtered ? SearchX : Award}
              title={filtered ? "No badges match" : "No badges to show yet"}
              description={filtered ? "Try a different search or clear the filters." : undefined}
            />
          ) : (
            <>
              {active.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map((c) => (
                    <PublicBadgeCard key={c.public_id} certificate={c} slug={slug} today={today} />
                  ))}
                </div>
              )}
              {expired.length > 0 && (
                <div className="flex flex-col gap-5">
                  <button
                    type="button"
                    onClick={() => setShowExpired((v) => !v)}
                    aria-expanded={showExpired}
                    className="mx-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showExpired ? "Hide" : "Show"} expired ({expired.length})
                    <ChevronDown
                      className={cn("size-4 transition-transform", showExpired && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                  {showExpired && (
                    <div className="grid gap-5 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
                      {expired.map((c) => (
                        <PublicBadgeCard key={c.public_id} certificate={c} slug={slug} today={today} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Skills Wallet">
          <SkillsWallet slug={slug} certificates={certificates} onShowBadges={showSkill} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Search, SearchX, Sparkles } from "lucide-react";
import { cn } from "cn";
import { BadgeIcon } from "@/components/certnest/badge-icon";
import { EmptyState } from "@/components/certnest/empty-state";
import { formatMonthYear } from "@/lib/format";
import type { PublicCertificate } from "@/lib/sharing/public";
import { portfolioBadgePath, publicImagePath } from "@/lib/sharing/urls";

type Sort = "badges" | "recent" | "name";
const SORTS: { value: Sort; label: string }[] = [
  { value: "badges", label: "Most badges" },
  { value: "recent", label: "Most recent" },
  { value: "name", label: "A–Z" },
];
const PREVIEW = 5;

type SkillRow = { name: string; badges: PublicCertificate[]; newest: number };

// Skills as an aligned, searchable list. Each row expands to the badges that
// provide evidence for the skill (newest first, 5 at a time).
export function SkillsWallet({
  slug,
  certificates,
  onShowBadges,
}: {
  slug: string;
  certificates: PublicCertificate[];
  onShowBadges: (skill: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("badges");
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    // `certificates` arrive newest first, so index order is recency.
    const map = new Map<string, SkillRow>();
    certificates.forEach((c, i) => {
      for (const name of c.skills) {
        const row = map.get(name) ?? { name, badges: [], newest: i };
        row.badges.push(c);
        row.newest = Math.min(row.newest, i);
        map.set(name, row);
      }
    });
    const q = query.trim().toLowerCase();
    const list = [...map.values()].filter((r) => !q || r.name.toLowerCase().includes(q));
    list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "recent"
          ? a.newest - b.newest || a.name.localeCompare(b.name)
          : b.badges.length - a.badges.length || a.name.localeCompare(b.name),
    );
    return list;
  }, [certificates, query, sort]);

  function toggle(name: string) {
    setOpen((current) => (current === name ? null : name));
    setShowAll(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by skill name"
            aria-label="Search by skill name"
            className="h-11 w-full rounded-xl border bg-background pr-4 pl-10 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-11 rounded-xl border bg-background px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          role={query.trim() ? "status" : undefined}
          icon={query.trim() ? SearchX : Sparkles}
          title={query.trim() ? "No skills match" : "No skills to show yet"}
          description={query.trim() ? "Try a different skill name." : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const expanded = open === row.name;
            const visible = expanded && !showAll ? row.badges.slice(0, PREVIEW) : row.badges;
            const panelId = `skill-${encodeURIComponent(row.name)}`;
            return (
              <li
                key={row.name}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card transition-shadow",
                  expanded ? "border-primary/30 shadow-md" : "hover:shadow-sm",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(row.name)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{row.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {row.badges.length} {row.badges.length === 1 ? "badge" : "badges"}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn("size-5 shrink-0 text-primary transition-transform", expanded && "rotate-180")}
                    aria-hidden
                  />
                </button>

                {expanded && (
                  <div id={panelId} className="flex flex-col gap-1 border-t bg-muted/40 px-3 py-3">
                    {visible.map((c) => (
                      <Link
                        key={c.public_id}
                        href={portfolioBadgePath(slug, c.public_id)}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-background"
                      >
                        <BadgeIcon
                          issuer={c.issuer_name}
                          imageSrc={c.image_key ? publicImagePath("p", slug, c.image_key) : null}
                          className="size-10 rounded [&>div]:text-base"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.issuer_name}
                            {c.issued_at && <> · Issued {formatMonthYear(c.issued_at)}</>}
                          </span>
                        </span>
                      </Link>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2">
                      {row.badges.length > PREVIEW ? (
                        <button
                          type="button"
                          onClick={() => setShowAll((v) => !v)}
                          className="text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          {showAll ? "Show fewer" : `Show all ${row.badges.length} badges`}
                        </button>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => onShowBadges(row.name)}
                        className="flex items-center gap-1 text-sm font-medium text-primary"
                      >
                        View in Badge Wallet <ArrowRight className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

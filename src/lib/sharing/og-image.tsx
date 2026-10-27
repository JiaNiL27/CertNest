import "server-only";
import { ImageResponse } from "next/og";
import { initials } from "@/lib/format";
import type { PublicPortfolio } from "./public";

// Link-preview image for a portfolio (LinkedIn, X, Facebook, chat apps).
// Built only from public portfolio data; routes generate it per request so a
// turned-off portfolio stops producing an image too.
export function portfolioOgImage(portfolio: PublicPortfolio) {
  const { display_name, certificates } = portfolio;
  const counts = new Map<string, number>();
  for (const s of certificates.flatMap((c) => c.skills)) counts.set(s, (counts.get(s) ?? 0) + 1);
  const topSkills = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s]) => s);
  const stat = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #e6f4f1 0%, #f7fbfa 55%, #ffffff 100%)",
          color: "#173a40",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, color: "#0f5e57" }}>
          <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: "#0f5e57" }} />
          CertNest
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 180,
              height: 180,
              borderRadius: 90,
              background: "#ffffff",
              border: "12px solid #d3ebe6",
              fontSize: 76,
              color: "#0f5e57",
            }}
          >
            {initials(display_name)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>{display_name}</div>
            <div style={{ display: "flex", fontSize: 34, color: "#55707a" }}>
              {stat(certificates.length, "badge")} · {stat(counts.size, "skill")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {topSkills.map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                background: "#ffffff",
                border: "2px solid #c4e2dc",
                fontSize: 26,
                color: "#0f5e57",
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    },
  );
}

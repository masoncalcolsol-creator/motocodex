// app/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

type Item = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  series: string | null;          // model-assigned / inferred
  series_override: string | null; // manual override from admin
  published_at: string | null;
};

const SERIES: { code: string; label: string }[] = [
  { code: "ALL", label: "ALL" },

  // Core racing series (keep your existing ones if you already have them)
  { code: "SX", label: "SX" },
  { code: "MX", label: "MX" },
  { code: "SMX", label: "SMX" },
  { code: "WSX", label: "WSX" },
  { code: "WMX", label: "WMX" },
  { code: "MXGP", label: "MXGP" },

  // NEW categories requested
  { code: "FMX", label: "FMX" },
  { code: "SMXNEXT", label: "SMXNEXT" },
  { code: "NEWS", label: "NEWS" },
  { code: "DISCOUNTS", label: "DISCOUNTS" },
  { code: "PODCAST", label: "PODCAST" },
  { code: "INTERVIEW", label: "INTERVIEW" },
];

function activeSeries(seriesParam?: string) {
  const s = (seriesParam || "ALL").toUpperCase();
  return SERIES.some(x => x.code === s) ? s : "ALL";
}

function getBaseUrl() {
  // Works on Vercel + locally
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function fetchFeed(series: string): Promise<Item[]> {
  const base = getBaseUrl();
  const url = new URL("/api/feed", base);
  if (series && series !== "ALL") url.searchParams.set("series", series);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const data = await res.json();
  return (data?.items || []) as Item[];
}

export default async function Page({
  searchParams,
}: {
  searchParams: { series?: string };
}) {
  const series = activeSeries(searchParams.series);
  const items = await fetchFeed(series);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "16px 12px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Header (pure drudge: no hero image) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: 0.5 }}>MOTO CODEX</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          <Link href="/admin" style={{ color: "inherit", textDecoration: "underline" }}>admin</Link>
        </div>
      </div>

      {/* Series filter row */}
      <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13 }}>
          {SERIES.map(s => {
            const isActive = series === s.code;
            const href = s.code === "ALL" ? "/" : `/?series=${encodeURIComponent(s.code)}`;
            return (
              <Link
                key={s.code}
                href={href}
                style={{
                  textDecoration: "none",
                  fontWeight: isActive ? 800 : 400,
                  color: isActive ? "#000" : "#111",
                }}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <div style={{ marginTop: 14 }}>
        {items.length === 0 ? (
          <div style={{ padding: "18px 0", color: "#444" }}>
            No posts found for <b>{series}</b>.
          </div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {items.map((it) => {
              const effectiveSeries = (it.series_override || it.series || "").toUpperCase();
              return (
                <li key={it.id} style={{ marginBottom: 10, lineHeight: 1.25 }}>
                  <a href={it.url} target="_blank" rel="noreferrer" style={{ color: "#0000EE", textDecoration: "underline" }}>
                    {it.title}
                  </a>
                  <div style={{ fontSize: 12, color: "#333", marginTop: 2 }}>
                    {it.source ? <span>{it.source}</span> : <span>source</span>}
                    {effectiveSeries ? <span> • {effectiveSeries}</span> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}

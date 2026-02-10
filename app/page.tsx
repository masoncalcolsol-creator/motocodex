// app/page.tsx
import Link from "next/link";

type Item = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  series: string | null;
  series_override: string | null;
  published_at: string | null;
};

const SERIES: { code: string; label: string }[] = [
  { code: "ALL", label: "All" },

  // Core racing
  { code: "SX", label: "SX" },
  { code: "MX", label: "MX" },
  { code: "SMX", label: "SMX" },
  { code: "WSX", label: "WSX" },
  { code: "WMX", label: "WMX" },
  { code: "MXGP", label: "MXGP" },

  // Expanded categories
  { code: "FMX", label: "FMX" },
  { code: "SMXNEXT", label: "SMXNEXT" },
  { code: "NEWS", label: "NEWS" },
  { code: "DISCOUNTS", label: "DISCOUNTS" },
  { code: "PODCAST", label: "PODCAST" },
  { code: "INTERVIEW", label: "INTERVIEW" },
];

function getBaseUrl() {
  // Works on Vercel + locally
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function activeSeries(seriesParam?: string) {
  const s = (seriesParam || "ALL").toUpperCase();
  return SERIES.some((x) => x.code === s) ? s : "ALL";
}

async function fetchFeed(series: string) {
  const base = getBaseUrl();
  const url =
    series === "ALL" ? `${base}/api/posts` : `${base}/api/posts?series=${series}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as Item[];
}

export default async function Page({
  searchParams,
}: {
  searchParams: { series?: string };
}) {
  const series = activeSeries(searchParams.series);
  const items = await fetchFeed(series);

  return (
    <main>
      <h1>MotoCodex</h1>
      <p className="tagline">drudge-style racing index • fast links • no fluff</p>

      <nav className="series-nav">
        {SERIES.map((s) => (
          <Link
            key={s.code}
            href={s.code === "ALL" ? "/" : `/?series=${s.code}`}
            className={series === s.code ? "active" : ""}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <section className="feed">
        {items.length === 0 && <p>No posts.</p>}

        {items.map((item) => (
          <div key={item.id} className="item">
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
            <div className="meta">
              {item.source} • {item.series_override || item.series}
            </div>
          </div>
        ))}
      </section>

      <footer>© 2026 MotoCodex • text-first racing index</footer>
    </main>
  );
}

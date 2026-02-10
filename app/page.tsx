// app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Post = {
  id: string;
  title: string;
  url: string;
  source: string;
  series: string;
  created_at?: string;
};

const FILTERS = [
  { label: "All", series: "" },
  { label: "SX", series: "SX" },
  { label: "MX", series: "MX" },
  { label: "SMX", series: "SMX" },
  { label: "WSX", series: "WSX" },
  { label: "WMX", series: "WMX" },
  { label: "MXGP", series: "MXGP" },
  { label: "Amateur", series: "AM" },
  { label: "News", series: "GEN" },
  { label: "Video", series: "VID" },
];

function qp(params: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.length) u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

function seriesFilterValues(series?: string) {
  if (!series) return null;
  const s = series.toUpperCase();

  // keep compatibility if any legacy strings still exist
  if (s === "GEN") return ["GEN", "News", "news"];
  if (s === "VID") return ["VID", "Video", "video"];
  if (s === "AM") return ["AM", "Amateur", "amateur"];

  return [s];
}

export default async function Home(props: {
  searchParams: any; // Next version may provide Promise here
}) {
  // ✅ This is the key fix: works whether searchParams is sync OR a Promise
  const sp = await Promise.resolve(props.searchParams);

  const series = sp.series ? String(sp.series).toUpperCase() : undefined;
  const q = sp.q ? String(sp.q).trim() : "";
  const source = sp.source ? String(sp.source).trim() : "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from("posts")
    .select("id,title,url,source,series,created_at")
    .limit(300);

  const seriesVals = seriesFilterValues(series);
  if (seriesVals) query = query.in("series", seriesVals);

  if (source) query = query.eq("source", source);
  if (q) query = query.ilike("title", `%${q}%`);

  // prefer ordering by created_at; fallback if column missing/disabled
  let posts: Post[] = [];
  const ordered = await query.order("created_at", { ascending: false });
  if (ordered.error) {
    const fallback = await query;
    posts = Array.isArray(fallback.data) ? (fallback.data as Post[]) : [];
  } else {
    posts = Array.isArray(ordered.data) ? (ordered.data as Post[]) : [];
  }

  const breaking = posts[0];
  const rest = posts.slice(1);

  const col1: Post[] = [];
  const col2: Post[] = [];
  const col3: Post[] = [];
  rest.forEach((p, i) => (i % 3 === 0 ? col1 : i % 3 === 1 ? col2 : col3).push(p));

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "24px auto",
        padding: "0 16px",
        fontFamily: "Georgia, 'Times New Roman', Times, serif",
        color: "#111",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 56, fontWeight: 700 }}>MotoCodex</h1>
          <div style={{ marginTop: 8, fontFamily: "Arial, sans-serif", fontSize: 14, color: "#444" }}>
            drudge-style racing index • fast links • no fluff
          </div>
        </div>

        {/* Search */}
        <form action="/" method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          {series ? <input type="hidden" name="series" value={series} /> : null}
          {source ? <input type="hidden" name="source" value={source} /> : null}

          <input
            name="q"
            defaultValue={q}
            placeholder="search riders / teams / brands..."
            style={{
              width: 320,
              padding: "10px 12px",
              border: "1px solid #bbb",
              borderRadius: 6,
              fontFamily: "Arial, sans-serif",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              border: "1px solid #999",
              background: "white",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "Arial, sans-serif",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Go
          </button>
        </form>
      </div>

      {/* Filters row */}
      <div style={{ marginTop: 18, borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd", padding: "12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            {FILTERS.map((f) => {
              const active = (f.series || "") === (series || "");
              return (
                <Link
                  key={f.label}
                  href={`/${qp({ series: f.series || undefined, q: q || undefined, source: source || undefined })}`}
                  style={{
                    textDecoration: "none",
                    color: "#111",
                    fontWeight: active ? 800 : 600,
                    borderBottom: active ? "2px solid #111" : "2px solid transparent",
                    paddingBottom: 2,
                  }}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#666" }}>
            Quick filters
          </div>
        </div>
      </div>

      {/* Breaking */}
      <section style={{ marginTop: 26, textAlign: "center" }}>
        <div style={{ color: "#b30000", fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>
          BREAKING
        </div>

        {breaking ? (
          <div style={{ marginTop: 10 }}>
            <a
              href={breaking.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                textDecoration: "none",
                color: "#111",
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.1,
                maxWidth: 800,
              }}
            >
              {breaking.title}
            </a>

            <div style={{ marginTop: 10, fontFamily: "Arial, sans-serif", fontSize: 12, color: "#666" }}>
              {breaking.source} • {breaking.series}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, fontFamily: "Arial, sans-serif", color: "#666" }}>No posts yet</div>
        )}
      </section>

      {/* 3-column headlines */}
      <section style={{ marginTop: 26 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40 }}>
          {[col1, col2, col3].map((col, idx) => (
            <div key={idx}>
              {col.map((p) => (
                <div key={p.id} style={{ marginBottom: 18 }}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: "none",
                      color: "#111",
                      fontSize: 18,
                      fontWeight: 800,
                      lineHeight: 1.15,
                      display: "inline-block",
                    }}
                  >
                    {p.title}
                  </a>
                  <div style={{ marginTop: 6, fontFamily: "Arial, sans-serif", fontSize: 12, color: "#666" }}>
                    {p.source} • {p.series}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid #ddd", fontFamily: "Arial, sans-serif", fontSize: 12, color: "#555" }}>
        © 2026 MotoCodex • text-first racing index
      </footer>
    </main>
  );
}

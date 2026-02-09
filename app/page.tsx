import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server Component
export default async function Home({
  searchParams,
}: {
  searchParams?: { q?: string; source?: string; series?: string };
}) {
  const q = (searchParams?.q || "").trim();
  const source = (searchParams?.source || "").trim();
  const series = (searchParams?.series || "").trim();

  // Pull posts
  let query = supabase
    .from("posts")
    .select("id,title,url,source,series,created_at")
    .order("created_at", { ascending: false })
    .limit(600);

  if (source) query = query.eq("source", source);
  if (series) query = query.eq("series", series);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: posts, error } = await query;

  // Source list
  const { data: sourcesData } = await supabase
    .from("posts")
    .select("source")
    .order("created_at", { ascending: false })
    .limit(600);

  const sourceCounts = new Map<string, number>();
  (sourcesData || []).forEach((r: any) => {
    const s = (r?.source || "Unknown").trim();
    if (!s) return;
    sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1);
  });

  const topSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name]) => name);

  const seriesOptions = [
    { key: "", label: "All" },
    { key: "SX", label: "SX" },
    { key: "MX", label: "MX" },
    { key: "SMX", label: "SMX" },
    { key: "WSX", label: "WSX" },
    { key: "WMX", label: "WMX" },
    { key: "MXGP", label: "MXGP" },
    { key: "Amateur", label: "Amateur" },
    { key: "News", label: "News" },
    { key: "Video", label: "Video" },
  ];

  const buildHref = (next: { q?: string; source?: string; series?: string }) => {
    const sp = new URLSearchParams();
    const nq = next.q ?? q;
    const ns = next.source ?? source;
    const nser = next.series ?? series;

    if (nq) sp.set("q", nq);
    if (ns) sp.set("source", ns);
    if (nser) sp.set("series", nser);

    const qs = sp.toString();
    return qs ? `/?${qs}` : `/`;
  };

  const clearAllHref = () => (q ? `/?q=${encodeURIComponent(q)}` : `/`);

  const pickBySeries = (s: string, limit = 8) =>
    (posts || []).filter((p: any) => (p.series || "") === s).slice(0, limit);

  const latest = (posts || []).slice(0, 60);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "26px auto",
        padding: "0 14px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, letterSpacing: 0.2 }}>MotoCodex</h1>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            drudge-style racing index • fast links • no fluff
          </div>
        </div>

        <div style={{ fontSize: 12, textAlign: "right" }}>
          <div style={{ opacity: 0.7 }}>Quick filters</div>
          <div style={{ marginTop: 6 }}>
            {seriesOptions.map((opt) => {
              const active = (series || "") === opt.key;
              return (
                <Link
                  key={opt.key || "all"}
                  href={buildHref({ series: opt.key, source: "" })}
                  style={{
                    display: "inline-block",
                    marginLeft: 10,
                    textDecoration: "none",
                    fontWeight: active ? 700 : 400,
                    opacity: active ? 1 : 0.75,
                  }}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <hr style={{ margin: "18px 0" }} />

      {/* Active filter chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Active:</div>

        {series ? (
          <span style={{ fontSize: 12, padding: "3px 8px", border: "1px solid #ddd" }}>
            series: <b>{series}</b>
          </span>
        ) : null}

        {source ? (
          <span style={{ fontSize: 12, padding: "3px 8px", border: "1px solid #ddd" }}>
            source: <b>{source}</b>
          </span>
        ) : null}

        {q ? (
          <span style={{ fontSize: 12, padding: "3px 8px", border: "1px solid #ddd" }}>
            search: <b>{q}</b>
          </span>
        ) : null}

        {(series || source) && (
          <Link href={clearAllHref()} style={{ fontSize: 12, marginLeft: 6 }}>
            clear filters
          </Link>
        )}
      </div>

      {error ? (
        <p style={{ color: "crimson", marginTop: 16 }}>Database error: {error.message}</p>
      ) : null}

      {/* Buckets */}
      {!series && !source && !q ? (
        <section style={{ marginTop: 16, border: "1px solid #ddd", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Top buckets</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              { label: "SX", items: pickBySeries("SX", 6) },
              { label: "MX", items: pickBySeries("MX", 6) },
              { label: "SMX", items: pickBySeries("SMX", 6) },
            ].map((bucket) => (
              <div key={bucket.label}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  <Link href={buildHref({ series: bucket.label })} style={{ textDecoration: "none" }}>
                    {bucket.label}
                  </Link>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.45 }}>
                  {bucket.items.length ? (
                    bucket.items.map((p: any) => (
                      <li key={p.id} style={{ marginBottom: 4 }}>
                        <a href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          {p.title}
                        </a>
                      </li>
                    ))
                  ) : (
                    <li style={{ opacity: 0.7 }}>No posts yet</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3-column Drudge layout */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 280px",
          gap: 18,
          marginTop: 18,
          alignItems: "start",
        }}
      >
        {/* Left column: sources */}
        <aside style={{ border: "1px solid #ddd", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Sources</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
            {topSources.map((s) => (
              <li key={s}>
                <Link href={buildHref({ source: s })} style={{ textDecoration: "none" }}>
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* Center column: latest */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 14, margin: "0 0 10px 0" }}>
              Latest {series ? `• ${series}` : ""} {source ? `• ${source}` : ""} {q ? `• "${q}"` : ""}
            </h2>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{latest.length} shown</div>
          </div>

          <ul style={{ lineHeight: 1.55, margin: 0, paddingLeft: 18 }}>
            {latest.length ? (
              latest.map((post: any) => (
                <li key={post.id} style={{ marginBottom: 6 }}>
                  <a href={post.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    {post.title}
                  </a>{" "}
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    (
                    <Link href={buildHref({ series: post.series || "" , source: "" })} style={{ textDecoration: "none" }}>
                      {post.series || "General"}
                    </Link>
                    {" — "}
                    <Link href={buildHref({ source: post.source || "" })} style={{ textDecoration: "none" }}>
                      {post.source || "Unknown"}
                    </Link>
                    )
                  </span>
                </li>
              ))
            ) : (
              <li>No posts yet</li>
            )}
          </ul>
        </div>

        {/* Right column: search + buckets */}
        <aside style={{ border: "1px solid #ddd", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Search</div>

          <form action="/" method="get" style={{ display: "flex", gap: 8 }}>
            <input
              name="q"
              defaultValue={q}
              placeholder="webb / smx / ktm..."
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #ccc",
                fontSize: 12,
              }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 10px",
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Go
            </button>
          </form>

          {/* preserve other filters if set */}
          {source ? <input type="hidden" name="source" value={source} /> : null}
          {series ? <input type="hidden" name="series" value={series} /> : null}

          <div style={{ fontSize: 12, fontWeight: 700, margin: "14px 0 8px" }}>Quick buckets</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
            {["SX", "MX", "SMX", "MXGP", "WMX", "WSX", "Amateur", "Video", "News"].map((s) => (
              <li key={s}>
                <Link href={buildHref({ series: s, source: "" })} style={{ textDecoration: "none" }}>
                  {s}
                </Link>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            Tip: click any <b>series</b> or <b>source</b> next to a headline.
          </div>
        </aside>
      </section>

      <footer style={{ marginTop: 28, fontSize: 12, opacity: 0.7 }}>
        <hr />
        © {new Date().getFullYear()} MotoCodex • text-first racing index
      </footer>
    </main>
  );
}

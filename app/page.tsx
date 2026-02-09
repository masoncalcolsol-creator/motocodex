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

  // Pull posts (keep it simple + fast)
  let query = supabase
    .from("posts")
    .select("id,title,url,source,series,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (source) query = query.eq("source", source);
  if (series) query = query.eq("series", series);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: posts, error } = await query;

  // Get top sources for sidebar (based on recent data)
  const { data: sourcesData } = await supabase
    .from("posts")
    .select("source")
    .order("created_at", { ascending: false })
    .limit(400);

  const sourceCounts = new Map<string, number>();
  (sourcesData || []).forEach((r: any) => {
    const s = (r?.source || "Unknown").trim();
    if (!s) return;
    sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1);
  });

  const topSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([name]) => name);

  const seriesOptions = [
    { key: "", label: "All" },
    { key: "News", label: "News" },
    { key: "SX", label: "SX" },
    { key: "MX", label: "MX" },
    { key: "SMX", label: "SMX" },
    { key: "WSX", label: "WSX" },
    { key: "WMX", label: "WMX" },
    { key: "MXGP", label: "MXGP" },
    { key: "Amateur", label: "Amateur" },
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

  const clearHref = () => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return qs ? `/?${qs}` : `/`;
  };

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "28px auto",
        padding: "0 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, letterSpacing: 0.2 }}>MotoCodex</h1>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            text-first racing index • fast links • no fluff
          </div>
        </div>

        <div style={{ fontSize: 12, textAlign: "right" }}>
          <div style={{ opacity: 0.7 }}>Filters</div>
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
          <Link href={clearHref()} style={{ fontSize: 12, marginLeft: 6 }}>
            clear filters
          </Link>
        )}
      </div>

      {error ? (
        <p style={{ color: "crimson", marginTop: 16 }}>Database error: {error.message}</p>
      ) : null}

      {/* Layout */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 22, marginTop: 18 }}>
        {/* Main column */}
        <div>
          <h2 style={{ fontSize: 14, margin: "0 0 10px 0", letterSpacing: 0.2 }}>
            Latest {series ? `• ${series}` : ""} {source ? `• ${source}` : ""}
          </h2>

          <ul style={{ lineHeight: 1.55, margin: 0, paddingLeft: 18 }}>
            {posts && posts.length > 0 ? (
              posts.slice(0, 80).map((post: any) => (
                <li key={post.id} style={{ marginBottom: 6 }}>
                  <a href={post.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    {post.title}
                  </a>{" "}
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    (
                    <Link href={buildHref({ series: post.series || "" , source: "" })} style={{ opacity: 0.9 }}>
                      {post.series || "General"}
                    </Link>
                    {" — "}
                    <Link href={buildHref({ source: post.source || "" })} style={{ opacity: 0.9 }}>
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

          {/* By-source quick sections (Drudge-ish) */}
          <div style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: 13, margin: "0 0 10px 0", opacity: 0.9 }}>By Source</h3>

            {topSources.slice(0, 8).map((s) => {
              const list = (posts || []).filter((p: any) => (p.source || "Unknown") === s).slice(0, 6);
              if (list.length === 0) return null;

              return (
                <div key={s} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    <Link href={buildHref({ source: s })} style={{ textDecoration: "none" }}>
                      {s}
                    </Link>
                  </div>
                  <ul style={{ lineHeight: 1.5, margin: 0, paddingLeft: 18 }}>
                    {list.map((p: any) => (
                      <li key={p.id} style={{ marginBottom: 4 }}>
                        <a href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          {p.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <aside>
          <div style={{ border: "1px solid #ddd", padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Search</div>

            {/* Simple search via links so we don’t add client JS yet */}
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
              (Type in the URL bar like: <span style={{ fontFamily: "monospace" }}>?q=webb</span>)
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, margin: "14px 0 8px" }}>Top Sources</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
              {topSources.map((s) => (
                <li key={s}>
                  <Link href={buildHref({ source: s })} style={{ textDecoration: "none" }}>
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
            Tip: Click any <b>series</b> or <b>source</b> next to a headline to filter instantly.
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

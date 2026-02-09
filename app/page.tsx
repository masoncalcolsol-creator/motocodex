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

  // Pull posts (simplified search)
  let query = supabase
    .from("posts")
    .select("id,title,url,source,series,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (source) query = query.eq("source", source);
  if (series) query = query.eq("series", series);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: posts, error } = await query;

  // Series options for filtering (simplified version)
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
          <Link href={clearAllHref()} style={{ fontSize: 12, marginLeft: 6 }}>
            clear filters
          </Link>
        )}
      </div>

      {error ? (
        <p style={{ color: "crimson", marginTop: 16 }}>Database error: {error.message}</p>
      ) : null}

      {/* Layout */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 22, marginTop: 18 }}>
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
        </div>
      </section>

      <footer style={{ marginTop: 32, fontSize: 12, opacity: 0.7 }}>
        <hr />
        © {new Date().getFullYear()} MotoCodex • text-first racing index
      </footer>
    </main>
  );
}

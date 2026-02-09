import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 60;

function clamp(s: string, n = 120) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? "").trim();

  // Latest posts (optionally filtered by search term against title/source/series)
  let postsQuery = supabase
    .from("posts")
    .select("id,title,url,source,series,created_at")
    .order("created_at", { ascending: false })
    .limit(120);

  if (q) {
    // ilike across a few fields
    const like = `%${q}%`;
    postsQuery = postsQuery.or(
      `title.ilike.${like},source.ilike.${like},series.ilike.${like}`
    );
  }

  const [{ data: posts }, { data: sources }] = await Promise.all([
    postsQuery,
    supabase
      .from("sources")
      .select("id,name,url,series")
      .order("name", { ascending: true }),
  ]);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "24px auto",
        padding: "0 14px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#111",
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.5 }}>
              MotoCodex
            </h1>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
              drudge-style racing index • fast links • no fluff
            </div>
          </div>

          {/* Search */}
          <form
            action="/"
            method="get"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            <input
              name="q"
              defaultValue={q}
              placeholder="search: webb / smx / ktm…"
              style={{
                width: 240,
                padding: "7px 9px",
                border: "1px solid #ccc",
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              style={{
                padding: "7px 10px",
                border: "1px solid #ccc",
                background: "#f7f7f7",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Go
            </button>
          </form>
        </div>
      </header>

      <hr style={{ border: "none", borderTop: "1px solid #ddd" }} />

      {/* 3-column Drudge-ish layout */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr 260px",
          gap: 18,
          marginTop: 14,
        }}
      >
        {/* Left: Sources */}
        <aside>
          <div
            style={{
              border: "1px solid #e6e6e6",
              padding: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
              Sources
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {(sources ?? []).map((s: any) => (
                <li key={s.id} style={{ marginBottom: 8, fontSize: 13 }}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#111", textDecoration: "none" }}
                  >
                    {s.name}
                  </a>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>
                    {" "}
                    • {s.series || "News"}
                  </span>
                </li>
              ))}
              {(!sources || sources.length === 0) && (
                <li style={{ fontSize: 13, opacity: 0.7 }}>No sources yet</li>
              )}
            </ul>
          </div>
        </aside>

        {/* Center: Latest */}
        <article>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>
              Latest{q ? ` — “${q}”` : ""}
            </h2>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              {(posts ?? []).length} shown
            </div>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(posts ?? []).map((p: any) => (
              <li
                key={p.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #efefef",
                }}
              >
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "#000",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 15,
                    lineHeight: 1.3,
                  }}
                >
                  {p.title}
                </a>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  {p.series || "News"} • {p.source || "Unknown"}
                </div>
              </li>
            ))}
            {(!posts || posts.length === 0) && (
              <li style={{ padding: "12px 0", opacity: 0.7 }}>
                No posts yet.
              </li>
            )}
          </ul>
        </article>

        {/* Right: About / Help */}
        <aside>
          <div
            style={{
              border: "1px solid #e6e6e6",
              padding: 12,
              background: "#fff",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              How to use
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
              Use the search box to filter by rider, team, series, bike brand, or
              anything in titles.
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Tip: try “SMX”, “MXGP”, “KTM”, “Webb”, “Honda”.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e6e6e6",
              padding: 12,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              Admin
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
              Ingest runs via your API route.
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
              /api/ingest?secret=…
            </div>
          </div>
        </aside>
      </section>

      <footer style={{ marginTop: 22, fontSize: 12, opacity: 0.6 }}>
        <hr style={{ border: "none", borderTop: "1px solid #ddd" }} />
        © {new Date().getFullYear()} MotoCodex
      </footer>
    </main>
  );
}

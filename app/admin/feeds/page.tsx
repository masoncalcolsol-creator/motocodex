// FILE: C:\MotoCODEX\app\feeds\page.tsx
// Replace the ENTIRE file with this.

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SocialPost = {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string | null;
  published_at: string;
  source_id: string;
  platform: string;
};

type SocialSource = {
  id: string;
  title: string | null;
  handle: string | null;
  platform: string;
};

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

function fmt(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function first(searchParams: Record<string, string | string[] | undefined>, key: string): string {
  const v = searchParams[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function FeedsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = first(searchParams, "q").trim();
  const platformParam = first(searchParams, "platform").trim().toLowerCase();

  const platform =
    platformParam === "youtube" ? "youtube" :
    platformParam === "instagram" ? "instagram" :
    "all";

  const supabase = supabasePublic();

  // Load sources for label mapping (enabled only)
  const { data: sources } = await supabase
    .from("social_sources")
    .select("id,title,handle,platform")
    .eq("enabled", true);

  const sourceMap = new Map<string, SocialSource>();
  (sources ?? []).forEach((s: any) => sourceMap.set(s.id, s));

  let query = supabase
    .from("social_posts")
    .select("id,title,url,thumbnail_url,published_at,source_id,platform")
    .order("published_at", { ascending: false })
    .limit(300);

  if (platform !== "all") {
    query = query.eq("platform", platform);
  } else {
    query = query.in("platform", ["youtube", "instagram"]);
  }

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: posts, error } = await query;

  const base = "/feeds";
  const qs = (p: string) => {
    const u = new URL("https://example.com" + base);
    if (q) u.searchParams.set("q", q);
    if (p !== "all") u.searchParams.set("platform", p);
    return u.pathname + u.search;
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>MotoFEEDS</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Master feed (YouTube + Instagram). Sorted newest → oldest. Search with <code>?q=</code>.
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <a href={qs("all")} style={{ textDecoration: "none" }}>
              <button style={{ padding: "8px 10px", cursor: "pointer", fontWeight: platform === "all" ? 800 : 400 }}>
                All
              </button>
            </a>
            <a href={qs("youtube")} style={{ textDecoration: "none" }}>
              <button style={{ padding: "8px 10px", cursor: "pointer", fontWeight: platform === "youtube" ? 800 : 400 }}>
                YouTube
              </button>
            </a>
            <a href={qs("instagram")} style={{ textDecoration: "none" }}>
              <button style={{ padding: "8px 10px", cursor: "pointer", fontWeight: platform === "instagram" ? 800 : 400 }}>
                Instagram
              </button>
            </a>
          </div>
        </div>

        <form method="GET" action="/feeds" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="platform" value={platform === "all" ? "" : platform} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search titles…"
            style={{ padding: "10px 12px", width: 280, maxWidth: "70vw" }}
          />
          <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
            Search
          </button>
          {q || platform !== "all" ? (
            <a href="/feeds" style={{ padding: "10px 12px", textDecoration: "none" }}>
              Clear
            </a>
          ) : null}
        </form>
      </div>

      {error ? (
        <pre style={{ marginTop: 16, padding: 12, background: "#111", color: "#fff", borderRadius: 8 }}>
          ERROR: {error.message}
        </pre>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {(posts as any[] | null)?.map((p: SocialPost) => {
          const src = sourceMap.get(p.source_id);
          const label =
            src?.title ||
            (src?.handle ? `@${src.handle}` : null) ||
            p.platform;

          return (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr",
                gap: 12,
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #ddd",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div style={{ width: 160, height: 90, background: "#f2f2f2" }}>
                {p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnail_url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>

              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {label} • {p.platform.toUpperCase()} • {fmt(p.published_at)}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                  {p.title}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7, wordBreak: "break-all" }}>
                  {p.url}
                </div>
              </div>
            </a>
          );
        })}

        {(posts ?? []).length === 0 ? (
          <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 10, opacity: 0.8 }}>
            No posts found{q ? ` for "${q}"` : ""}.
          </div>
        ) : null}
      </div>
    </div>
  );
}
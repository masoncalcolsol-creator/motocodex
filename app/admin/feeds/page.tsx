// FILE: C:\MotoCODEX\app\feeds\page.tsx
// Create this file.

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

export default async function FeedsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qRaw = searchParams.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw || "").trim();

  const supabase = supabasePublic();

  // Load sources for label mapping
  const { data: sources } = await supabase
    .from("social_sources")
    .select("id,title,handle,platform")
    .eq("platform", "youtube")
    .eq("enabled", true);

  const sourceMap = new Map<string, SocialSource>();
  (sources ?? []).forEach((s: any) => sourceMap.set(s.id, s));

  let query = supabase
    .from("social_posts")
    .select("id,title,url,thumbnail_url,published_at,source_id")
    .eq("platform", "youtube")
    .order("published_at", { ascending: false })
    .limit(200);

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: posts, error } = await query;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>MotoFEEDS</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            YouTube-first master feed. Sorted newest → oldest. Search with <code>?q=</code>.
          </div>
        </div>

        <form method="GET" action="/feeds" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search titles…"
            style={{ padding: "10px 12px", width: 280, maxWidth: "70vw" }}
          />
          <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
            Search
          </button>
          {q ? (
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
            "YouTube";

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
                  {label} • {fmt(p.published_at)}
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
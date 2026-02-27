// FILE: app/page.tsx
// Replace the ENTIRE file with this.
// MotoCODEX vNext: Left = LATEST (published_at), Center = RANKED (importance w/ recency decay), Right = PODS
// URL params: ?q=keyword  (search)   ?sort=ranked|newest  (optional; default newest)

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NewsItem = {
  id: string;
  source_key: string;
  source_name: string | null;
  title: string;
  url: string;
  importance: number | null;
  credibility: number | null;
  momentum: number | null;
  is_breaking: boolean | null;
  tags: string[] | null;
  created_at: string | null;
  published_at: string | null;
};

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // Hard kill caching in fetch path
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function hoursSince(iso: string | null) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 36e5;
}

function recencyBoost(publishedOrCreated: string | null) {
  // Simple, smooth decay. Newer = bigger boost.
  // 0h -> 1.0, 12h -> ~0.5, 24h -> ~0.33, 72h -> ~0.14, 168h -> ~0.06
  const h = hoursSince(publishedOrCreated);
  if (h === null) return 0.15;
  return 1 / (1 + h / 12);
}

function rankedScore(item: NewsItem) {
  const base = clamp(Number(item.importance ?? 0), 0, 100);
  const cred = clamp(Number(item.credibility ?? 50), 0, 100);
  const mom = clamp(Number(item.momentum ?? 50), 0, 100);

  // Weighted blend that still respects your existing importance values.
  const blended =
    base * 0.65 +
    cred * 0.20 +
    mom * 0.15;

  const when = item.published_at ?? item.created_at ?? null;
  const rec = recencyBoost(when);

  // Multiply by recency to keep the center column “alive”.
  return blended * (0.55 + 0.45 * rec);
}

function getLensFromTag(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("450")) return "450";
  if (t.includes("250")) return "250";
  if (t.includes("sx")) return "SX";
  if (t.includes("mxgp")) return "MXGP";
  if (t.includes("motogp")) return "MotoGP";
  if (t.includes("ama")) return "AMA";
  return tag;
}

function chipLabel(item: NewsItem) {
  const tags = item.tags || [];
  if (tags.length === 0) return item.source_name || item.source_key;
  // Prefer a “class/lens” looking tag if present
  const preferred =
    tags.find((t) => /450|250|sx|supercross|mxgp|motogp|ama/i.test(t)) || tags[0];
  return getLensFromTag(preferred);
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Local-ish compact
  return d.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPods(items: NewsItem[]) {
  const counts = new Map<string, number>();
  for (const it of items) {
    const tags = it.tags || [];
    for (const t of tags) {
      const key = getLensFromTag(t);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const arr = Array.from(counts.entries())
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v || a.k.localeCompare(b.k));

  return arr;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { q?: string; sort?: string };
}) {
  const supabase = supabasePublic();

  const qRaw = (searchParams?.q || "").trim();
  const q = qRaw.length > 0 ? qRaw : null;

  const sort = (searchParams?.sort || "").toLowerCase();
  const sortMode = sort === "ranked" ? "ranked" : "newest";

  // Pull a bigger slice so ranked + pods have enough data to work with
  let query = supabase
    .from("news_items")
    .select(
      "id,source_key,source_name,title,url,importance,credibility,momentum,is_breaking,tags,created_at,published_at"
    )
    .limit(500);

  // Basic keyword filter (title OR url OR source_name). Simple, fast, good enough.
  // NOTE: `ilike` is case-insensitive.
  if (q) {
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    query = query.or(
      `title.ilike.${like},url.ilike.${like},source_name.ilike.${like},source_key.ilike.${like}`
    );
  }

  // Always fetch newest-ish first so the slice contains recent items
  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        <h1 style={{ margin: 0 }}>MotoCODEX</h1>
        <p style={{ opacity: 0.7 }}>DB error</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  const items = (data || []) as NewsItem[];

  // LATEST rail (true time-based)
  const latest = [...items].sort((a, b) => {
    const ta = Date.parse(a.published_at || a.created_at || "") || 0;
    const tb = Date.parse(b.published_at || b.created_at || "") || 0;
    return tb - ta;
  });

  // RANKED rail (importance + recency)
  const ranked = [...items].sort((a, b) => rankedScore(b) - rankedScore(a));

  // Center column selection can be either ranked or newest based on sortMode
  const center = sortMode === "ranked" ? ranked : latest;

  const pods = buildPods(items);

  const baseUrl = q ? `/?q=${encodeURIComponent(q)}` : `/`;
  const newestHref = q ? `/?q=${encodeURIComponent(q)}&sort=newest` : `/?sort=newest`;
  const rankedHref = q ? `/?q=${encodeURIComponent(q)}&sort=ranked` : `/?sort=ranked`;

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      {/* TOP BAR */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "12px 10px",
          margin: "-16px -16px 12px -16px",
          background: "#0b0b0b",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 800, letterSpacing: 0.5, color: "#fff" }}>MotoCODEX</div>
            <div style={{ opacity: 0.7, color: "#fff", fontSize: 12 }}>
              {items.length} items{q ? ` • search: "${q}"` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a
              href={baseUrl}
              style={{
                color: "#fff",
                opacity: q ? 1 : 0.7,
                textDecoration: "none",
                fontSize: 12,
                padding: "6px 10px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
              }}
              title="Clear search"
            >
              {q ? "Clear" : "Home"}
            </a>

            <a
              href={newestHref}
              style={{
                color: "#fff",
                textDecoration: "none",
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: sortMode === "newest" ? "rgba(255,255,255,0.08)" : "transparent",
              }}
              title="Center column = newest"
            >
              Newest
            </a>

            <a
              href={rankedHref}
              style={{
                color: "#fff",
                textDecoration: "none",
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: sortMode === "ranked" ? "rgba(255,255,255,0.08)" : "transparent",
              }}
              title="Center column = ranked"
            >
              Ranked
            </a>
          </div>
        </div>

        {/* simple search bar */}
        <form
          action="/"
          method="get"
          style={{ marginTop: 10, display: "flex", gap: 8 }}
        >
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="Search (q=)..."
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              outline: "none",
            }}
          />
          <input type="hidden" name="sort" value={sortMode} />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,0,0,0.15)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Go
          </button>
        </form>
      </div>

      {/* GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.35fr 0.9fr",
          gap: 14,
        }}
      >
        {/* LEFT: LATEST */}
        <section
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Inside Rut • LATEST</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {latest.slice(0, 70).map((it) => (
              <a
                key={it.id}
                href={it.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: "none",
                  color: "#111",
                  lineHeight: 1.25,
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                  paddingBottom: 8,
                }}
              >
                <div style={{ fontWeight: it.is_breaking ? 900 : 650 }}>
                  {it.is_breaking ? "🚨 " : ""}
                  {it.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>
                  {fmtTime(it.published_at || it.created_at)} • {safeHost(it.url)} • {chipLabel(it)}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* CENTER: RANKED (or NEWEST based on toggle) */}
        <section
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Main Line • {sortMode === "ranked" ? "RANKED" : "NEWEST"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {center.slice(0, 60).map((it) => {
              const s = rankedScore(it);
              return (
                <a
                  key={it.id}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    color: "#111",
                    lineHeight: 1.25,
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    paddingBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: it.is_breaking ? 900 : 750 }}>
                      {it.is_breaking ? "🚨 " : ""}
                      {it.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                      }}
                      title="Rank score (importance + credibility + momentum + recency)"
                    >
                      {sortMode === "ranked" ? s.toFixed(1) : ""}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                    {fmtTime(it.published_at || it.created_at)} • {safeHost(it.url)} •{" "}
                    {it.source_name || it.source_key}
                    {it.importance != null ? ` • imp:${it.importance}` : ""}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* RIGHT: PODS */}
        <aside
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Outside Berm • PODS</div>

          {pods.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>No tags found yet.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {pods.slice(0, 50).map((p) => (
                <span
                  key={p.k}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(0,0,0,0.02)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                  title={`Tag: ${p.k}`}
                >
                  {p.k}
                  <span
                    style={{
                      fontWeight: 800,
                      opacity: 0.75,
                    }}
                  >
                    {p.v}
                  </span>
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65, lineHeight: 1.35 }}>
            Tip: use <b>?q=</b> to filter. Example:{" "}
            <a href="/?q=deegan&sort=ranked" style={{ color: "#111" }}>
              q=deegan
            </a>
          </div>
        </aside>
      </div>

      {/* MOBILE: stack columns */}
      <style>{`
        @media (max-width: 1020px) {
          main > div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
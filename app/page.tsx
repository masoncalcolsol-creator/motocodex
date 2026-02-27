// FILE: C:\MotoCODEX\app\page.tsx
// Replace the ENTIRE file with this.

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NewsItem = {
  id: string;
  title: string;
  url: string;
  source_key: string;
  source_name: string | null;
  tags: string[] | null;
  importance: number | null;
  credibility: number | null;
  momentum: number | null;
  recency: number | null;
  score: number | null; // your ranked score column if present; safe if null
  published_at: string | null;
  created_at: string | null;
};

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

function safeHostname(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const h = u.hostname.replace(/^www\./i, "").trim();
    return h.length ? h : null;
  } catch {
    return null;
  }
}

function normalizePod(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function derivePods(item: NewsItem): string[] {
  const tags = (item.tags ?? []).filter(Boolean).map((t) => normalizePod(String(t)));
  if (tags.length) return tags;

  const host = safeHostname(item.url);
  if (host) return [normalizePod(host)];

  if (item.source_name && item.source_name.trim().length) {
    return [normalizePod(item.source_name)];
  }

  return [normalizePod(item.source_key)];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default async function Page({
  searchParams,
}: {
  searchParams: { q?: string; sort?: "newest" | "ranked" };
}) {
  const q = (searchParams?.q ?? "").trim();
  const sort = (searchParams?.sort ?? "ranked") as "newest" | "ranked";

  const supabase = supabasePublic();

  // --- Query base
  let query = supabase
    .from("news_items")
    .select(
      "id,title,url,source_key,source_name,tags,importance,credibility,momentum,recency,score,published_at,created_at"
    )
    .limit(240);

  // --- Search filter
  if (q.length) {
    // NOTE: avoids needing full-text config; keep deterministic.
    // If you already have a better SQL function, swap later.
    query = query.or(`title.ilike.%${q}%,source_name.ilike.%${q}%,source_key.ilike.%${q}%`);
  }

  // --- Sorting
  if (sort === "newest") {
    // Prefer published_at if present, then created_at.
    query = query.order("published_at", { ascending: false, nullsFirst: false });
    query = query.order("created_at", { ascending: false, nullsFirst: false });
  } else {
    // Ranked: prefer score desc, then created_at as stable tie-breaker.
    query = query.order("score", { ascending: false, nullsFirst: false });
    query = query.order("created_at", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;
  const items: NewsItem[] = (data ?? []) as any;

  // --- Pods aggregation w/ fallback
  const podCounts = new Map<string, number>();
  for (const it of items) {
    for (const pod of derivePods(it)) {
      if (!pod) continue;
      podCounts.set(pod, (podCounts.get(pod) ?? 0) + 1);
    }
  }

  const podsSorted = Array.from(podCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  const toggleHref = (nextSort: "newest" | "ranked") => {
    const params = new URLSearchParams();
    if (q.length) params.set("q", q);
    params.set("sort", nextSort);
    return `/?${params.toString()}`;
  };

  const lensTitleLeft = "Inside Rut";
  const lensTitleMid = "Main Line";
  const lensTitleRight = "Outside Berm";

  return (
    <main style={{ minHeight: "100vh", background: "#0b0b0d", color: "#eaeaea" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(11,11,13,0.92)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 14px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>
              MotoCODEX <span style={{ opacity: 0.6, fontWeight: 600 }}>Phase 2</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
              <Link
                href={toggleHref("newest")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: sort === "newest" ? "rgba(255,0,60,0.20)" : "transparent",
                  color: "#eaeaea",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Newest
              </Link>
              <Link
                href={toggleHref("ranked")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: sort === "ranked" ? "rgba(255,0,60,0.20)" : "transparent",
                  color: "#eaeaea",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Ranked
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <form action="/" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="hidden" name="sort" value={sort} />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search (q=) …"
                style={{
                  width: 360,
                  maxWidth: "90vw",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#eaeaea",
                  outline: "none",
                  fontSize: 14,
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,0,60,0.18)",
                  color: "#eaeaea",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Go
              </button>
              {q.length ? (
                <Link
                  href={`/?sort=${sort}`}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "transparent",
                    color: "#eaeaea",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Clear
                </Link>
              ) : null}
            </form>

            <div style={{ opacity: 0.75, fontSize: 13, paddingTop: 10 }}>
              Showing <b>{items.length}</b> items{q.length ? (
                <>
                  {" "}
                  for <b>{q}</b>
                </>
              ) : null}
              .
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.35fr 0.75fr",
            gap: 14,
          }}
        >
          {/* LEFT */}
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>{lensTitleLeft}</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>Stream view ({sort === "newest" ? "Newest" : "Ranked"})</div>
            </div>

            <div style={{ padding: 8 }}>
              {items.slice(0, 60).map((it) => (
                <a
                  key={`L-${it.id}`}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    padding: "10px 10px",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: "#eaeaea",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(0,0,0,0.18)",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, lineHeight: 1.2 }}>{it.title}</div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>{(it.source_name ?? it.source_key) || "unknown"}</span>
                    <span>•</span>
                    <span>{safeHostname(it.url) ?? "link"}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* MIDDLE */}
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>{lensTitleMid}</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>
                Prioritized view (score-driven) • tie-break by recency
              </div>
            </div>

            <div style={{ padding: 8 }}>
              {items.slice(0, 90).map((it) => {
                const score = typeof it.score === "number" ? it.score : null;
                const s = score === null ? "" : clamp(score, 0, 999).toFixed(1);
                return (
                  <a
                    key={`M-${it.id}`}
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "block",
                      padding: "12px 12px",
                      borderRadius: 14,
                      textDecoration: "none",
                      color: "#eaeaea",
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(0,0,0,0.22)",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <div style={{ fontWeight: 900, lineHeight: 1.2, flex: 1 }}>{it.title}</div>
                      {s.length ? (
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: 12,
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,0,60,0.35)",
                            background: "rgba(255,0,60,0.16)",
                            color: "#ffd6df",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 7, fontSize: 12, opacity: 0.75, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span>{(it.source_name ?? it.source_key) || "unknown"}</span>
                      <span>•</span>
                      <span>{safeHostname(it.url) ?? "link"}</span>
                      {it.tags?.length ? (
                        <>
                          <span>•</span>
                          <span>{it.tags.slice(0, 3).join(", ")}</span>
                        </>
                      ) : null}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* RIGHT */}
          <aside
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>{lensTitleRight}</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>
                Pods (tags → fallback hostname/source)
              </div>
            </div>

            <div style={{ padding: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {podsSorted.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 13 }}>No pods yet.</div>
              ) : (
                podsSorted.map(([pod, count]) => (
                  <Link
                    key={`P-${pod}`}
                    href={`/?q=${encodeURIComponent(pod)}&sort=${sort}`}
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(0,0,0,0.25)",
                      color: "#eaeaea",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                    title={`Filter by: ${pod}`}
                  >
                    <span>{pod}</span>
                    <span style={{ opacity: 0.7, fontWeight: 900 }}>({count})</span>
                  </Link>
                ))
              )}
            </div>

            <div style={{ padding: "0 12px 12px 12px", opacity: 0.65, fontSize: 12, lineHeight: 1.35 }}>
              Clicking a pod runs <b>?q=</b> against title/source. Tags will get smarter next when ingest emits real
              entity labels.
            </div>
          </aside>
        </div>

        {/* Mobile fallback: stack columns */}
        <style>{`
          @media (max-width: 980px) {
            main > div > div {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </main>
  );
}
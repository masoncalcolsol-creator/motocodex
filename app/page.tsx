// FILE: C:\MotoCODEX\app\page.tsx
// Replace the ENTIRE file with this.
//
// Fixes:
// - Never shows "unknown" for source label
// - Subtitles rewritten to permanent user-facing language
// - Adds /feeds link in header
//
// Keeps:
// - published_at newest in center
// - mobile single scroll toggle view=newest|ranked
// - pods from tags-first

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
  thumbnail_url?: string | null;
  published_at: string | null;
  created_at: string | null;
};

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
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

function pickSourceLabel(it: NewsItem): string {
  const a = (it.source_name ?? "").trim();
  if (a) return a;

  const b = (it.source_key ?? "").trim();
  if (b) return b;

  const h = safeHostname(it.url);
  if (h) return h;

  return "MotoCODEX";
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

function derivePodsFromTagsFirst(item: NewsItem): string[] {
  const tags = (item.tags ?? [])
    .filter(Boolean)
    .map((t) => normalizePod(String(t)))
    .filter(Boolean);

  if (tags.length) return tags;

  // LAST resort fallback (only if tags missing)
  const host = safeHostname(item.url);
  if (host) return [normalizePod(host)];

  const name = (item.source_name ?? "").trim();
  if (name) return [normalizePod(name)];

  const key = (item.source_key ?? "").trim();
  if (key) return [normalizePod(key)];

  return ["motocodex"];
}

function isProbablyYouTube(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

export default async function Page({
  searchParams,
}: {
  searchParams: { q?: string; view?: "newest" | "ranked" };
}) {
  const q = (searchParams?.q ?? "").trim();
  const view = (searchParams?.view ?? "newest") as "newest" | "ranked";

  let newestItems: NewsItem[] = [];
  let rankedItems: NewsItem[] = [];
  let pageError: string | null = null;

  try {
    const supabase = supabasePublic();

    const selectCols =
      "id,title,url,source_key,source_name,tags,importance,thumbnail_url,published_at,created_at";

    // --- NEWEST (published_at desc, fallback created_at)
    let newestQ = supabase.from("news_items").select(selectCols).limit(240);

    if (q.length) newestQ = newestQ.or(`title.ilike.%${q}%,source_name.ilike.%${q}%,source_key.ilike.%${q}%`);

    newestQ = newestQ.order("published_at", { ascending: false, nullsFirst: false });
    newestQ = newestQ.order("created_at", { ascending: false, nullsFirst: false });

    const newestRes = await newestQ;
    if (newestRes.error) {
      pageError = `Supabase query error (newest): ${newestRes.error.message}`;
    } else {
      newestItems = (newestRes.data ?? []) as any;
    }

    // --- RANKED (importance desc, tie-break by published_at desc)
    let rankedQ = supabase.from("news_items").select(selectCols).limit(240);

    if (q.length) rankedQ = rankedQ.or(`title.ilike.%${q}%,source_name.ilike.%${q}%,source_key.ilike.%${q}%`);

    rankedQ = rankedQ.order("importance", { ascending: false, nullsFirst: false });
    rankedQ = rankedQ.order("published_at", { ascending: false, nullsFirst: false });
    rankedQ = rankedQ.order("created_at", { ascending: false, nullsFirst: false });

    const rankedRes = await rankedQ;
    if (rankedRes.error) {
      pageError = pageError ?? `Supabase query error (ranked): ${rankedRes.error.message}`;
    } else {
      rankedItems = (rankedRes.data ?? []) as any;
    }
  } catch (e: any) {
    pageError = e?.message ? String(e.message) : "Unknown server error.";
  }

  // Pods: build counts from BOTH lists
  const podCounts = new Map<string, number>();
  for (const it of [...newestItems, ...rankedItems]) {
    for (const pod of derivePodsFromTagsFirst(it)) {
      if (!pod) continue;
      podCounts.set(pod, (podCounts.get(pod) ?? 0) + 1);
    }
  }
  const podsSorted = Array.from(podCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50);

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q.length) params.set("q", q);
    params.set("view", view);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    return `/?${params.toString()}`;
  };

  const CardThumb = ({ it }: { it: NewsItem }) => {
    if (!it.thumbnail_url) return null;
    return (
      <div
        style={{
          width: 84,
          height: 56,
          borderRadius: 12,
          overflow: "hidden",
          flex: "0 0 auto",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.06)",
        }}
        title={isProbablyYouTube(it.url) ? "Video" : "Media"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={it.thumbnail_url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  };

  const renderCard = (it: NewsItem, keyPrefix: string) => (
    <a
      key={`${keyPrefix}-${it.id}`}
      href={it.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 12px",
        borderRadius: 14,
        textDecoration: "none",
        color: "#eaeaea",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.22)",
        marginBottom: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, lineHeight: 1.2 }}>{it.title}</div>
        <div style={{ marginTop: 7, fontSize: 12, opacity: 0.78, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{pickSourceLabel(it)}</span>
          <span>•</span>
          <span>{safeHostname(it.url) ?? "link"}</span>
          {it.tags?.length ? (
            <>
              <span>•</span>
              <span>{it.tags.slice(0, 4).join(", ")}</span>
            </>
          ) : null}
        </div>
      </div>
      <CardThumb it={it} />
    </a>
  );

  const mobileItems = view === "ranked" ? rankedItems : newestItems;

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
            <div style={{ fontWeight: 900, letterSpacing: 0.5 }}>
              MotoCODEX <span style={{ opacity: 0.6, fontWeight: 700 }}>Phase 2</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap", alignItems: "center" }}>
              <Link
                href="/feeds"
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#eaeaea",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                MotoFEEDS
              </Link>

              <Link
                href={hrefWith({ view: "newest" })}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: view === "newest" ? "rgba(255,0,60,0.20)" : "transparent",
                  color: "#eaeaea",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                Mobile: Newest
              </Link>
              <Link
                href={hrefWith({ view: "ranked" })}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: view === "ranked" ? "rgba(255,0,60,0.20)" : "transparent",
                  color: "#eaeaea",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                Mobile: Ranked
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <form action="/" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="hidden" name="view" value={view} />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search … (q=)"
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
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Go
              </button>

              {q.length ? (
                <Link
                  href={hrefWith({ q: undefined })}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "transparent",
                    color: "#eaeaea",
                    textDecoration: "none",
                    fontWeight: 900,
                  }}
                >
                  Clear
                </Link>
              ) : null}
            </form>

            <div style={{ opacity: 0.75, fontSize: 13, paddingTop: 10 }}>
              Newest: <b>{newestItems.length}</b> • Ranked: <b>{rankedItems.length}</b>
              {q.length ? (
                <>
                  {" "}
                  • query <b>{q}</b>
                </>
              ) : null}
            </div>
          </div>

          {pageError ? (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,0,60,0.35)",
                background: "rgba(255,0,60,0.12)",
                color: "#ffd6df",
                fontSize: 13,
                fontWeight: 900,
                lineHeight: 1.4,
              }}
            >
              {pageError}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px" }}>
        {/* MOBILE SINGLE FEED */}
        <section
          className="mobileOnly"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(255,255,255,0.03)",
            marginBottom: 14,
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontWeight: 900 }}>
              Latest Breaking News • {view === "ranked" ? "Ranked Feed" : "Newest Feed"}
            </div>
            <div style={{ opacity: 0.65, fontSize: 12 }}>
              Single scroll. Default is newest by published date.
            </div>
          </div>
          <div style={{ padding: 8 }}>
            {mobileItems.slice(0, 160).map((it) => renderCard(it, "MB"))}
          </div>
        </section>

        {/* DESKTOP 3 COLUMN */}
        <div className="desktopOnly" style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr 0.75fr", gap: 14 }}>
          {/* LEFT */}
          <section style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>Inside Rut</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>Ranked Feed (importance → published date)</div>
            </div>
            <div style={{ padding: 8 }}>
              {rankedItems.slice(0, 70).map((it) => renderCard(it, "L"))}
            </div>
          </section>

          {/* CENTER */}
          <section style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>Main Line</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>Latest Breaking News (published date → ingest time)</div>
            </div>
            <div style={{ padding: 8 }}>
              {newestItems.slice(0, 110).map((it) => renderCard(it, "M"))}
            </div>
          </section>

          {/* RIGHT */}
          <aside style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>Outside Berm</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>Topic Pods (tags-driven)</div>
            </div>

            <div style={{ padding: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {podsSorted.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 13 }}>No pods yet.</div>
              ) : (
                podsSorted.map(([pod, count]) => (
                  <Link
                    key={`P-${pod}`}
                    href={hrefWith({ q: pod })}
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
                      fontWeight: 900,
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
              Pods are topics (injuries, riders, teams). We’ll keep expanding the tag dictionary.
            </div>
          </aside>
        </div>

        <style>{`
          .mobileOnly { display: none; }
          .desktopOnly { display: block; }

          @media (max-width: 980px) {
            .mobileOnly { display: block; }
            .desktopOnly { display: none; }
          }
        `}</style>
      </div>
    </main>
  );
}
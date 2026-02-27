// FILE: C:\MotoCODEX\app\feeds\page.tsx
// Create this NEW file.
//
// MotoFEEDS v1 (YT first):
// - Pulls social_posts (YouTube only in v1)
// - Master feed sorted by published_at desc
// - Search q= across title/text/source
// - Simple 2-column desktop layout, single column mobile

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SocialPost = {
  id: string;
  platform: "youtube";
  source_handle: string | null;
  source_title: string | null;
  post_id: string | null;
  url: string;
  title: string | null;
  text: string | null;
  thumbnail_url: string | null;
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

function sourceLabel(p: SocialPost): string {
  const a = (p.source_title ?? "").trim();
  if (a) return a;
  const b = (p.source_handle ?? "").trim();
  if (b) return b;
  return safeHostname(p.url) ?? "MotoFEEDS";
}

export default async function FeedsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams?.q ?? "").trim();

  let posts: SocialPost[] = [];
  let pageError: string | null = null;

  try {
    const supabase = supabasePublic();

    let query = supabase
      .from("social_posts")
      .select("id,platform,source_handle,source_title,post_id,url,title,text,thumbnail_url,published_at,created_at")
      .eq("platform", "youtube")
      .limit(250);

    if (q.length) {
      query = query.or(`title.ilike.%${q}%,text.ilike.%${q}%,source_title.ilike.%${q}%,source_handle.ilike.%${q}%`);
    }

    query = query.order("published_at", { ascending: false, nullsFirst: false });
    query = query.order("created_at", { ascending: false, nullsFirst: false });

    const { data, error } = await query;
    if (error) pageError = `Supabase query error: ${error.message}`;
    else posts = (data ?? []) as any;
  } catch (e: any) {
    pageError = e?.message ? String(e.message) : "Unknown server error.";
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0b0d", color: "#eaeaea" }}>
      {/* TOP BAR */}
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
              MotoFEEDS <span style={{ opacity: 0.6, fontWeight: 700 }}>YT-first</span>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/"
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
                Back to MotoCODEX
              </Link>

              <a
                href="/api/feeds/youtube/run"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid rgba(255,0,60,0.35)",
                  background: "rgba(255,0,60,0.12)",
                  color: "#ffd6df",
                  fontSize: 13,
                  fontWeight: 900,
                }}
                title="Run YouTube ingest now"
              >
                Run YT ingest
              </a>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <form action="/feeds" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search MotoFEEDS … (q=)"
                style={{
                  width: 420,
                  maxWidth: "92vw",
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
                  href="/feeds"
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
              Showing <b>{posts.length}</b> YouTube items{q.length ? (
                <>
                  {" "}
                  for <b>{q}</b>
                </>
              ) : null}
              .
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

      {/* FEED */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.6fr",
            gap: 14,
          }}
        >
          <section style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>Master Moto Feed</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>Newest by published time</div>
            </div>

            <div style={{ padding: 8 }}>
              {posts.slice(0, 200).map((p) => (
                <a
                  key={p.id}
                  href={p.url}
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
                    <div style={{ fontWeight: 900, lineHeight: 1.2 }}>{p.title ?? "(untitled)"}</div>
                    <div style={{ marginTop: 7, fontSize: 12, opacity: 0.78, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span>{sourceLabel(p)}</span>
                      <span>•</span>
                      <span>{safeHostname(p.url) ?? "youtube"}</span>
                    </div>
                    {p.text ? (
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.68, lineHeight: 1.35 }}>
                        {p.text.slice(0, 180)}
                        {p.text.length > 180 ? "…" : ""}
                      </div>
                    ) : null}
                  </div>

                  {p.thumbnail_url ? (
                    <div
                      style={{
                        width: 120,
                        height: 80,
                        borderRadius: 12,
                        overflow: "hidden",
                        flex: "0 0 auto",
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.06)",
                      }}
                      title="YouTube"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.thumbnail_url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}
                </a>
              ))}
            </div>
          </section>

          <aside style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontWeight: 900 }}>Platforms</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>YT is live. IG/X next (via compliant routes).</div>
            </div>

            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.22)" }}>
                <div style={{ fontWeight: 900 }}>YouTube</div>
                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                  Ingest via channel RSS. Deterministic. No API keys.
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)", opacity: 0.85 }}>
                <div style={{ fontWeight: 900 }}>Instagram</div>
                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                  Home feed scraping isn’t available via official API. We’ll do curated account lists + compliant ingestion.
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)", opacity: 0.85 }}>
                <div style={{ fontWeight: 900 }}>X</div>
                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                  Needs official API access for reliability. We can wire it when you want.
                </div>
              </div>
            </div>
          </aside>
        </div>

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
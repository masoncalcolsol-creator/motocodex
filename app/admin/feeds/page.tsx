// FILE: C:\MotoCODEX\app\feeds\page.tsx
// Replace the ENTIRE file with this.

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SocialPost = {
  id: string;
  platform: string;
  source_id: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  created_at: string | null;
};

type SocialSource = {
  id: string;
  platform: string;
  title: string | null;
  handle: string | null;
  enabled: boolean;
};

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");

  return createClient(url, anon, {
    auth: { persistSession: false },
    global: {
      fetch: (input: any, init?: any) =>
        fetch(input, {
          ...(init || {}),
          cache: "no-store",
          headers: {
            ...(init?.headers || {}),
            "cache-control": "no-store",
            pragma: "no-cache",
          },
        }),
    },
  });
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

function fmt(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function supabaseHostHint() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  try {
    const u = new URL(url);
    const host = u.host || "";
    const ref = host.split(".")[0] || host;
    return ref ? `${ref}…` : "unknown";
  } catch {
    return "unknown";
  }
}

export default async function FeedsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const renderNonce = Date.now();
  const q = first(searchParams, "q").trim();
  const platformParam = first(searchParams, "platform").trim().toLowerCase();

  const platform =
    platformParam === "youtube" ? "youtube" :
    platformParam === "instagram" ? "instagram" :
    "all";

  let posts: SocialPost[] = [];
  let sources: SocialSource[] = [];
  let pageError: string | null = null;

  try {
    const supabase = supabasePublic();

    const srcRes = await supabase
      .from("social_sources")
      .select("id,platform,title,handle,enabled")
      .eq("enabled", true);

    if (srcRes.error) throw new Error(`Supabase sources error: ${srcRes.error.message}`);
    sources = (srcRes.data ?? []) as any;

    let query = supabase
      .from("social_posts")
      .select("id,platform,source_id,url,title,thumbnail_url,published_at,created_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1000);

    if (platform === "all") query = query.in("platform", ["youtube", "instagram"]);
    else query = query.eq("platform", platform);

    if (q.length) query = query.ilike("title", `%${q}%`);

    const { data, error } = await query;
    if (error) throw new Error(`Supabase posts error: ${error.message}`);
    posts = (data ?? []) as any;
  } catch (e: any) {
    pageError = e?.message ? String(e.message) : "Unknown server error.";
  }

  const sourceMap = new Map<string, SocialSource>();
  for (const s of sources) sourceMap.set(s.id, s);

  const ytCount = posts.filter((p) => p.platform === "youtube").length;
  const igCount = posts.filter((p) => p.platform === "instagram").length;

  const qs = (p: string) => {
    const u = new URL("https://example.com/feeds");
    if (q) u.searchParams.set("q", q);
    if (p !== "all") u.searchParams.set("platform", p);
    return u.pathname + u.search;
  };

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
              MotoFEEDS <span style={{ opacity: 0.6, fontWeight: 700 }}>YT + IG</span>
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
                href="/admin/feeds"
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
                Admin
              </a>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={qs("all")} style={{ textDecoration: "none" }}>
                <button
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: platform === "all" ? "rgba(255,0,60,0.20)" : "rgba(255,255,255,0.06)",
                    color: "#eaeaea",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  All
                </button>
              </a>

              <a href={qs("youtube")} style={{ textDecoration: "none" }}>
                <button
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: platform === "youtube" ? "rgba(255,0,60,0.20)" : "rgba(255,255,255,0.06)",
                    color: "#eaeaea",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  YouTube
                </button>
              </a>

              <a href={qs("instagram")} style={{ textDecoration: "none" }}>
                <button
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: platform === "instagram" ? "rgba(255,0,60,0.20)" : "rgba(255,255,255,0.06)",
                    color: "#eaeaea",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Instagram
                </button>
              </a>
            </div>

            <form action="/feeds" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {platform !== "all" ? <input type="hidden" name="platform" value={platform} /> : null}
              <input
                name="q"
                defaultValue={q}
                placeholder="Search titles… (q=)"
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
                  href={platform === "all" ? "/feeds" : `/feeds?platform=${platform}`}
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

            <div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 12 }}>
              Debug: render={renderNonce} • supabase={supabaseHostHint()} • returned yt={ytCount} ig={igCount} (limit 1000)
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

          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
            Showing <b>{posts.length}</b> items (YT={ytCount}, IG={igCount}){q.length ? (
              <>
                {" "}
                for <b>{q}</b>
              </>
            ) : null}
            .
          </div>
        </div>
      </div>

      {/* FEED */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px" }}>
        <section style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontWeight: 900 }}>Master Moto Feed</div>
            <div style={{ opacity: 0.65, fontSize: 12 }}>Newest by published time • YT + IG</div>
          </div>

          <div style={{ padding: 8 }}>
            {posts.map((p) => {
              const src = sourceMap.get(p.source_id);
              const label = (src?.title ?? "").trim() || (src?.handle ? `@${src.handle}` : "") || safeHostname(p.url) || "MotoFEEDS";
              const host = safeHostname(p.url) ?? p.platform;

              return (
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
                    <div style={{ fontWeight: 900, lineHeight: 1.2 }}>
                      {p.title ?? "(untitled)"}
                    </div>
                    <div style={{ marginTop: 7, fontSize: 12, opacity: 0.78, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span>{label}</span>
                      <span>•</span>
                      <span style={{ textTransform: "uppercase" }}>{p.platform}</span>
                      <span>•</span>
                      <span>{host}</span>
                      <span>•</span>
                      <span>{fmt(p.published_at ?? p.created_at)}</span>
                    </div>
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
                      title={p.platform}
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
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 60;

function clamp(s: string, n = 140) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function toStr(v: any) {
  return typeof v === "string" ? v : "";
}

// Try to grab og:image from the target URL (best-effort).
async function getOgImage(url: string): Promise<string | null> {
  if (!url) return null;

  // Many sites block bots; this is best-effort only.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Some sites require a UA to respond with HTML
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; MotoCodexBot/1.0; +https://motocodex.vercel.app/)",
        accept: "text/html,application/xhtml+xml",
      },
      // Avoid caching issues; Next will cache per revalidate anyway
      cache: "no-store",
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Very simple meta tag parse (works for most pages)
    const ogMatch =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i
      );

    if (!ogMatch?.[1]) return null;

    let img = ogMatch[1].trim();

    // Handle relative URLs
    if (img.startsWith("//")) img = "https:" + img;
    if (img.startsWith("/")) {
      try {
        const u = new URL(url);
        img = `${u.origin}${img}`;
      } catch {
        return null;
      }
    }

    // Basic sanity
    if (!/^https?:\/\//i.test(img)) return null;

    return img;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams?: { q?: string; series?: string; source?: string };
}) {
  const q = (searchParams?.q ?? "").trim();
  const series = (searchParams?.series ?? "").trim();
  const source = (searchParams?.source ?? "").trim();

  let query = supabase
    .from("posts")
    .select("id,title,url,source,series,created_at")
    .order("created_at", { ascending: false })
    .limit(90);

  if (q) {
    // If you have Postgres full-text later, we’ll swap to that.
    query = query.or(
      `title.ilike.%${q}%,source.ilike.%${q}%,series.ilike.%${q}%`
    );
  }
  if (series && series !== "All") query = query.eq("series", series);
  if (source && source !== "All") query = query.eq("source", source);

  const { data: postsRaw } = await query;
  const posts = postsRaw ?? [];

  // BREAKING: pick the most recent item (or first "News" if present)
  const breaking =
    posts.find((p: any) => toStr(p.series).toLowerCase() === "news") ?? posts[0];

  const breakingTitle = breaking ? toStr(breaking.title) : "";
  const breakingUrl = breaking ? toStr(breaking.url) : "";
  const breakingSource = breaking ? toStr(breaking.source) : "";
  const breakingSeries = breaking ? toStr(breaking.series) : "";

  const breakingImage = breakingUrl ? await getOgImage(breakingUrl) : null;

  // Remove breaking item from the headline streams (so it doesn’t repeat)
  const stream = breaking
    ? posts.filter((p: any) => p.id !== breaking.id)
    : posts;

  // Distribute into 3 columns like Drudge headline lists
  const col1: any[] = [];
  const col2: any[] = [];
  const col3: any[] = [];

  stream.forEach((p: any, i: number) => {
    if (i % 3 === 0) col1.push(p);
    else if (i % 3 === 1) col2.push(p);
    else col3.push(p);
  });

  const TopNav = () => (
    <header style={{ padding: "18px 0 10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            MotoCodex
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            drudge-style racing index • fast links • no fluff
          </div>
        </div>

        <form
          action="/"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="search riders / teams / brands…"
            style={{
              width: 260,
              padding: "8px 10px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 10px",
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Go
          </button>
        </form>
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid #ddd",
          display: "flex",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        {["All", "SX", "MX", "SMX", "WSX", "WMX", "MXGP", "Amateur", "News", "Video"].map(
          (k) => (
            <Link
              key={k}
              href={{
                pathname: "/",
                query: {
                  ...(q ? { q } : {}),
                  series: k === "All" ? undefined : k,
                },
              }}
              style={{
                textDecoration: "none",
                color: k === (series || "All") ? "#000" : "#444",
                fontWeight: k === (series || "All") ? 800 : 600,
              }}
            >
              {k}
            </Link>
          )
        )}
      </div>
    </header>
  );

  const HeadlineList = ({ items }: { items: any[] }) => (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 1.25 }}>
      {items.map((p) => (
        <li key={p.id} style={{ padding: "6px 0" }}>
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: "none",
              color: "#000",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {clamp(toStr(p.title), 180)}
          </a>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            {toStr(p.source) || "Unknown"}
            {toStr(p.series) ? ` • ${toStr(p.series)}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <main
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "0 14px 28px",
        fontFamily:
          'Arial, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      <TopNav />

      {/* BREAKING (top center-ish, Drudge vibe) */}
      {breaking ? (
        <section
          style={{
            borderTop: "1px solid #ddd",
            paddingTop: 14,
            marginTop: 8,
            display: "grid",
            gridTemplateColumns: "1fr minmax(520px, 2fr) 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div />

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                  color: "#b00020",
                }}
              >
                BREAKING
              </span>
            </div>

            {breakingImage ? (
              <a href={breakingUrl} target="_blank" rel="noreferrer">
                <img
                  src={breakingImage}
                  alt=""
                  style={{
                    width: "100%",
                    maxHeight: 260,
                    objectFit: "cover",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                  }}
                />
              </a>
            ) : null}

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <a
                href={breakingUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: "none",
                  color: "#000",
                  fontWeight: 900,
                  fontSize: 20,
                  lineHeight: 1.15,
                }}
              >
                {clamp(breakingTitle, 220)}
              </a>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                {breakingSource || "Unknown"}
                {breakingSeries ? ` • ${breakingSeries}` : ""}
              </div>
            </div>
          </div>

          <div />
        </section>
      ) : null}

      {/* 3-column headlines */}
      <section
        style={{
          marginTop: 16,
          borderTop: "1px solid #ddd",
          paddingTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 18,
        }}
      >
        <div>
          <HeadlineList items={col1} />
        </div>
        <div>
          <HeadlineList items={col2} />
        </div>
        <div>
          <HeadlineList items={col3} />
        </div>
      </section>

      <footer style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
        <hr style={{ border: 0, borderTop: "1px solid #eee" }} />
        © {new Date().getFullYear()} MotoCodex • text-first racing index
      </footer>
    </main>
  );
}

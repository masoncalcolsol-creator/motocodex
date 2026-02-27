// FILE: app/page.tsx

// Replace the ENTIRE file with this.
// MotoCODEX vNext (restored UI): Dark Drudge-style, 3 columns, real buttons, strong contrast.
// URL params: ?q=keyword   ?sort=newest|ranked   (default newest)
<div className="mcx-brand">MotoCODEX // DARK_UI_TEST_001</div>
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
  // 0h -> 1.0, 12h -> ~0.5, 24h -> ~0.33, 72h -> ~0.14, 168h -> ~0.06
  const h = hoursSince(publishedOrCreated);
  if (h === null) return 0.15;
  return 1 / (1 + h / 12);
}

function rankedScore(item: NewsItem) {
  const base = clamp(Number(item.importance ?? 0), 0, 100);
  const cred = clamp(Number(item.credibility ?? 50), 0, 100);
  const mom = clamp(Number(item.momentum ?? 50), 0, 100);

  const blended = base * 0.65 + cred * 0.20 + mom * 0.15;

  const when = item.published_at ?? item.created_at ?? null;
  const rec = recencyBoost(when);

  return blended * (0.55 + 0.45 * rec);
}

function getLensFromTag(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("450")) return "450";
  if (t.includes("250")) return "250";
  if (t.includes("sx")) return "SX";
  if (t.includes("supercross")) return "SX";
  if (t.includes("mxgp")) return "MXGP";
  if (t.includes("motogp")) return "MotoGP";
  if (t.includes("ama")) return "AMA";
  return tag;
}

function chipLabel(item: NewsItem) {
  const tags = item.tags || [];
  if (tags.length === 0) return item.source_name || item.source_key;
  const preferred =
    tags.find((t) => /450|250|sx|supercross|mxgp|motogp|ama/i.test(t)) || tags[0];
  return getLensFromTag(preferred);
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
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

  return Array.from(counts.entries())
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v || a.k.localeCompare(b.k));
}

function hrefWith(base: string, q: string | null, sortMode: "newest" | "ranked") {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("sort", sortMode);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
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
  const sortMode: "newest" | "ranked" = sort === "ranked" ? "ranked" : "newest";

  let query = supabase
    .from("news_items")
    .select(
      "id,source_key,source_name,title,url,importance,credibility,momentum,is_breaking,tags,created_at,published_at"
    )
    .limit(500);

  if (q) {
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    query = query.or(
      `title.ilike.${like},url.ilike.${like},source_name.ilike.${like},source_key.ilike.${like}`
    );
  }

  // Pull newest-ish first so our 500 slice contains the freshest items
  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return (
      <main className="mcx-shell">
        <div className="mcx-topbar">
          <div className="mcx-brand">MotoCODEX</div>
        </div>
        <div className="mcx-error">
          <div className="mcx-errorTitle">DB error</div>
          <pre className="mcx-pre">{JSON.stringify(error, null, 2)}</pre>
        </div>

        <style>{GLOBAL_CSS}</style>
      </main>
    );
  }

  const items = (data || []) as NewsItem[];

  const latest = [...items].sort((a, b) => {
    const ta = Date.parse(a.published_at || a.created_at || "") || 0;
    const tb = Date.parse(b.published_at || b.created_at || "") || 0;
    return tb - ta;
  });

  const ranked = [...items].sort((a, b) => rankedScore(b) - rankedScore(a));
  const center = sortMode === "ranked" ? ranked : latest;

  const pods = buildPods(items);

  const homeHref = "/";
  const newestHref = hrefWith("/", q, "newest");
  const rankedHref = hrefWith("/", q, "ranked");
  const clearHref = "/";

  return (
    <main className="mcx-shell">
      {/* TOP BAR */}
      <div className="mcx-topbar">
        <div className="mcx-topbarRow">
          <div className="mcx-brandWrap">
            <div className="mcx-brand">MotoCODEX</div>
            <div className="mcx-sub">
              {items.length} items{q ? ` • search: "${q}"` : ""}
            </div>
          </div>

          <div className="mcx-actions">
            <a className={`mcx-pill ${q ? "on" : ""}`} href={q ? clearHref : homeHref} title="Home / clear search">
              {q ? "Clear" : "Home"}
            </a>

            <a
              className={`mcx-pill ${sortMode === "newest" ? "active" : ""}`}
              href={newestHref}
              title="Center column = newest"
            >
              Newest
            </a>

            <a
              className={`mcx-pill ${sortMode === "ranked" ? "active" : ""}`}
              href={rankedHref}
              title="Center column = ranked"
            >
              Ranked
            </a>
          </div>
        </div>

        {/* SEARCH */}
        <form className="mcx-search" action="/" method="get">
          <input
            className="mcx-input"
            name="q"
            defaultValue={q || ""}
            placeholder="Search (q=)..."
            autoComplete="off"
          />
          <input type="hidden" name="sort" value={sortMode} />
          <button className="mcx-go" type="submit">
            Go
          </button>
        </form>

        <div className="mcx-hairline" />
      </div>

      {/* GRID */}
      <div className="mcx-grid">
        {/* LEFT */}
        <section className="mcx-card">
          <div className="mcx-cardTitle">
            <span className="mcx-railName">Inside Rut</span>
            <span className="mcx-railMode">LATEST</span>
          </div>

          <div className="mcx-list">
            {latest.slice(0, 80).map((it) => (
              <a key={it.id} className="mcx-item" href={it.url} target="_blank" rel="noreferrer">
                <div className={`mcx-title ${it.is_breaking ? "breaking" : ""}`}>
                  {it.is_breaking ? "🚨 " : ""}
                  {it.title}
                </div>
                <div className="mcx-meta">
                  {fmtTime(it.published_at || it.created_at)} • {safeHost(it.url)} • {chipLabel(it)}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* CENTER */}
        <section className="mcx-card">
          <div className="mcx-cardTitle">
            <span className="mcx-railName">Main Line</span>
            <span className="mcx-railMode">{sortMode === "ranked" ? "RANKED" : "NEWEST"}</span>
          </div>

          <div className="mcx-list">
            {center.slice(0, 70).map((it) => {
              const s = rankedScore(it);
              return (
                <a key={it.id} className="mcx-item" href={it.url} target="_blank" rel="noreferrer">
                  <div className="mcx-row">
                    <div className={`mcx-title center ${it.is_breaking ? "breaking" : ""}`}>
                      {it.is_breaking ? "🚨 " : ""}
                      {it.title}
                    </div>

                    {sortMode === "ranked" ? (
                      <div className="mcx-score" title="Rank score (importance + credibility + momentum + recency)">
                        {s.toFixed(1)}
                      </div>
                    ) : null}
                  </div>

                  <div className="mcx-meta">
                    {fmtTime(it.published_at || it.created_at)} • {safeHost(it.url)} •{" "}
                    {it.source_name || it.source_key}
                    {it.importance != null ? ` • imp:${it.importance}` : ""}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* RIGHT */}
        <aside className="mcx-card">
          <div className="mcx-cardTitle">
            <span className="mcx-railName">Outside Berm</span>
            <span className="mcx-railMode">PODS</span>
          </div>

          {pods.length === 0 ? (
            <div className="mcx-empty">
              <div>No tags found yet.</div>
              <div className="mcx-emptySub">That’s fine — tags show up once your ingest starts tagging.</div>
            </div>
          ) : (
            <div className="mcx-pods">
              {pods.slice(0, 60).map((p) => (
                <span key={p.k} className="mcx-pod" title={`Tag: ${p.k}`}>
                  <span className="mcx-podName">{p.k}</span>
                  <span className="mcx-podCount">{p.v}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mcx-tip">
            Tip: use <b>?q=</b> to filter •{" "}
            <a href="/?q=deegan&sort=ranked">q=deegan</a>
          </div>
        </aside>
      </div>

      <style>{GLOBAL_CSS}</style>
    </main>
  );
}

const GLOBAL_CSS = `
  :root{
    --bg:#070707;
    --panel:#0d0d0d;
    --panel2:#0f0f0f;
    --text:#f2f2f2;
    --muted:rgba(255,255,255,.68);
    --hair:rgba(255,255,255,.10);
    --hair2:rgba(255,255,255,.14);
    --accent:rgba(255,0,0,.55);
    --accent2:rgba(255,0,0,.22);
    --whitecard:#0e0e0e;
  }

  html,body{ margin:0; padding:0; background:var(--bg); color:var(--text); }
  *{ box-sizing:border-box; }
  a{ color:inherit; }

  .mcx-shell{
    padding:14px;
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
  }

  .mcx-topbar{
    position: sticky;
    top: 0;
    z-index: 50;
    margin: -14px -14px 12px -14px;
    padding: 12px 14px 10px 14px;
    background: linear-gradient(180deg, rgba(15,15,15,0.98), rgba(10,10,10,0.98));
    border-bottom: 1px solid var(--hair);
    backdrop-filter: blur(6px);
  }

  .mcx-topbarRow{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
  }

  .mcx-brandWrap{
    display:flex;
    align-items:baseline;
    gap:12px;
    min-width: 220px;
  }

  .mcx-brand{
    font-weight: 900;
    letter-spacing: .6px;
    font-size: 18px;
  }

  .mcx-sub{
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 54vw;
  }

  .mcx-actions{
    display:flex;
    gap:8px;
    align-items:center;
  }

  .mcx-pill{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--hair2);
    background: rgba(255,255,255,0.04);
    text-decoration:none;
    font-size: 12px;
    font-weight: 800;
    color: rgba(255,255,255,.9);
  }

  .mcx-pill.on{
    border-color: rgba(255,255,255,.22);
    background: rgba(255,255,255,0.06);
  }

  .mcx-pill.active{
    border-color: rgba(255,0,0,.40);
    background: var(--accent2);
    box-shadow: 0 0 18px rgba(255,0,0,.12);
  }

  .mcx-search{
    display:flex;
    gap:8px;
    margin-top: 10px;
  }

  .mcx-input{
    flex:1;
    padding: 11px 12px;
    border-radius: 12px;
    border: 1px solid var(--hair2);
    background: rgba(255,255,255,0.06);
    color: var(--text);
    outline: none;
  }

  .mcx-go{
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255,0,0,.35);
    background: rgba(255,0,0,.12);
    color: var(--text);
    cursor: pointer;
    font-weight: 900;
  }

  .mcx-go:hover{
    background: rgba(255,0,0,.16);
  }

  .mcx-hairline{
    margin-top: 10px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,0,0,.20), transparent);
    opacity: .9;
  }

  .mcx-grid{
    display:grid;
    grid-template-columns: 1fr 1.35fr .9fr;
    gap: 12px;
  }

  .mcx-card{
    border: 1px solid var(--hair);
    background: linear-gradient(180deg, rgba(18,18,18,.92), rgba(10,10,10,.92));
    border-radius: 14px;
    padding: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }

  .mcx-cardTitle{
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    gap:10px;
    padding: 6px 6px 10px 6px;
  }

  .mcx-railName{
    font-weight: 900;
    letter-spacing: .4px;
  }

  .mcx-railMode{
    font-size: 11px;
    font-weight: 900;
    color: rgba(255,255,255,.72);
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--hair2);
    background: rgba(255,255,255,0.04);
  }

  .mcx-list{
    display:flex;
    flex-direction:column;
    gap:10px;
  }

  .mcx-item{
    text-decoration:none;
    padding: 10px 8px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
  }

  .mcx-item:hover{
    border-color: rgba(255,0,0,.22);
    background: rgba(255,0,0,.05);
  }

  .mcx-title{
    font-weight: 800;
    line-height: 1.22;
    color: rgba(255,255,255,.96);
  }

  .mcx-title.center{
    font-weight: 850;
  }

  .mcx-title.breaking{
    text-shadow: 0 0 16px rgba(255,0,0,.16);
  }

  .mcx-meta{
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255,255,255,.68);
    line-height: 1.2;
  }

  .mcx-row{
    display:flex;
    justify-content:space-between;
    gap:10px;
    align-items:flex-start;
  }

  .mcx-score{
    font-size: 12px;
    font-weight: 900;
    color: rgba(255,255,255,.85);
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 10px;
    border: 1px solid rgba(255,0,0,.24);
    background: rgba(255,0,0,.08);
  }

  .mcx-pods{
    display:flex;
    flex-wrap:wrap;
    gap: 8px;
    padding: 6px;
  }

  .mcx-pod{
    display:inline-flex;
    align-items:center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.04);
    font-size: 12px;
    font-weight: 900;
  }

  .mcx-podCount{
    opacity: .75;
    font-weight: 900;
  }

  .mcx-empty{
    padding: 10px 8px;
    color: rgba(255,255,255,.75);
    font-size: 13px;
  }
  .mcx-emptySub{
    margin-top: 6px;
    color: rgba(255,255,255,.55);
    font-size: 12px;
  }

  .mcx-tip{
    margin-top: 12px;
    padding: 10px 8px;
    font-size: 12px;
    color: rgba(255,255,255,.60);
    line-height: 1.35;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .mcx-tip a{
    color: rgba(255,255,255,.92);
  }

  .mcx-error{
    margin-top: 16px;
    padding: 14px;
    border: 1px solid rgba(255,0,0,.25);
    border-radius: 14px;
    background: rgba(255,0,0,.06);
  }
  .mcx-errorTitle{
    font-weight: 900;
    margin-bottom: 8px;
  }
  .mcx-pre{
    white-space: pre-wrap;
    margin: 0;
    color: rgba(255,255,255,.9);
  }

  @media (max-width: 1020px){
    .mcx-grid{ grid-template-columns: 1fr; }
    .mcx-sub{ max-width: 70vw; }
  }
`;
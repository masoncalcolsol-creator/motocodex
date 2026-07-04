import Link from "next/link";
import MotoHeader from "@/components/MotoHeader";
import { filterMotoItems, getNews, topTags, type MotoItem } from "@/lib/moto";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  q?: string;
  tag?: string;
  view?: "newest" | "ranked";
};

function formatAge(value: string | null) {
  if (!value) return "time unknown";
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return "time unknown";
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function itemDate(item: MotoItem) {
  return item.publishedAt || item.createdAt;
}

function StoryCard({ item, emphasis = false }: { item: MotoItem; emphasis?: boolean }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className={emphasis ? styles.featureCard : styles.storyCard}>
      {item.thumbnailUrl ? (
        <div className={styles.thumbnail}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </div>
      ) : (
        <div className={styles.thumbnailFallback}>{item.sourceName.slice(0, 2).toUpperCase()}</div>
      )}
      <div className={styles.storyCopy}>
        <div className={styles.storyMeta}>
          <span>{item.sourceName}</span>
          <i />
          <span>{formatAge(itemDate(item))}</span>
          {item.platform !== "web" ? <b>{item.platform}</b> : null}
        </div>
        <h3>{item.title}</h3>
        {emphasis && item.summary ? <p>{item.summary}</p> : null}
        <div className={styles.tagRow}>
          {item.tags.slice(0, emphasis ? 5 : 3).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>
    </a>
  );
}

function HeadlineRow({ item, rank }: { item: MotoItem; rank?: number }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className={styles.headlineRow}>
      {rank ? <span className={styles.rank}>{String(rank).padStart(2, "0")}</span> : null}
      <div>
        <strong>{item.title}</strong>
        <span>{item.sourceName} · {formatAge(itemDate(item))}</span>
      </div>
      <b>{Math.round(item.importance)}</b>
    </a>
  );
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const query = String(searchParams?.q ?? "").trim();
  const tag = String(searchParams?.tag ?? "all").trim().toLowerCase();
  const view = searchParams?.view === "ranked" ? "ranked" : "newest";

  const data = await getNews(300);
  const filtered = filterMotoItems(data.items, { query, tag });
  const newest = [...filtered].sort((left, right) => {
    const leftTime = itemDate(left) ? new Date(itemDate(left)!).getTime() : 0;
    const rightTime = itemDate(right) ? new Date(itemDate(right)!).getTime() : 0;
    return rightTime - leftTime;
  });
  const ranked = [...filtered].sort((left, right) => right.importance - left.importance || newest.indexOf(left) - newest.indexOf(right));
  const activeItems = view === "ranked" ? ranked : newest;
  const tags = topTags(data.items, 20);
  const lead = activeItems[0];
  const supporting = activeItems.slice(1, 5);
  const wire = newest.slice(0, 18);
  const rankedTop = ranked.slice(0, 15);
  const sourceNames = new Set(data.items.map((item) => item.sourceName));
  const fresh24 = data.items.filter((item) => {
    const date = itemDate(item);
    return date ? Date.now() - new Date(date).getTime() < 86_400_000 : false;
  }).length;

  const makeHref = (patch: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const next = { q: query || undefined, tag: tag === "all" ? undefined : tag, view, ...patch };
    if (next.q) params.set("q", next.q);
    if (next.tag && next.tag !== "all") params.set("tag", next.tag);
    if (next.view && next.view !== "newest") params.set("view", next.view);
    const value = params.toString();
    return value ? `/?${value}` : "/";
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <MotoHeader active="codex" />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>LIVE MOTOCROSS INTELLIGENCE · NEWS / RESULTS / RIDERS / TEAMS</div>
            <h1>The whole moto world.<br /><span>One signal board.</span></h1>
            <p>
              MotoCODEX aggregates the fastest-moving Supercross, Motocross, SMX, MXGP, WSX, amateur, team, rider, and technical signals into one ranked operating feed.
            </p>
            <form action="/" className={styles.searchForm}>
              {tag !== "all" ? <input type="hidden" name="tag" value={tag} /> : null}
              {view !== "newest" ? <input type="hidden" name="view" value={view} /> : null}
              <input name="q" defaultValue={query} placeholder="Search riders, teams, series, injuries, results…" />
              <button type="submit">Search intelligence</button>
            </form>
          </div>

          <div className={styles.heroMetrics}>
            <div><strong>{data.items.length}</strong><span>signals loaded</span></div>
            <div><strong>{sourceNames.size}</strong><span>sources online</span></div>
            <div><strong>{fresh24}</strong><span>last 24 hours</span></div>
            <div><strong>{data.mode === "supabase" ? "DB" : data.mode === "live-rss" ? "LIVE" : "SAFE"}</strong><span>ingest mode</span></div>
            <div className={styles.modeReceipt}>
              <span>Current source path</span>
              <strong>{data.mode === "supabase" ? "Supabase historical store" : data.mode === "live-rss" ? "Live RSS failover" : "No current items"}</strong>
              <small>{data.sourceCount} responsive sources · refreshed {new Date(data.fetchedAt).toLocaleTimeString()}</small>
            </div>
          </div>
        </section>

        <section className={styles.controlBar}>
          <div className={styles.viewToggle}>
            <Link href={makeHref({ view: "newest" })} className={view === "newest" ? styles.activeControl : undefined}>Newest</Link>
            <Link href={makeHref({ view: "ranked" })} className={view === "ranked" ? styles.activeControl : undefined}>Ranked</Link>
          </div>
          <div className={styles.tagScroller}>
            <Link href={makeHref({ tag: "all" })} className={tag === "all" ? styles.activeTag : undefined}>All signals</Link>
            {tags.map((entry) => (
              <Link key={entry.tag} href={makeHref({ tag: entry.tag })} className={tag === entry.tag ? styles.activeTag : undefined}>
                {entry.tag}<span>{entry.count}</span>
              </Link>
            ))}
          </div>
        </section>

        {data.errors.length ? (
          <details className={styles.telemetryReceipt}>
            <summary>Ingest telemetry · {data.errors.length} recoverable source issue{data.errors.length === 1 ? "" : "s"}</summary>
            <div>{data.errors.slice(0, 12).map((error) => <p key={error}>{error}</p>)}</div>
          </details>
        ) : null}

        {lead ? (
          <section className={styles.commandGrid}>
            <div className={styles.leadColumn}>
              <div className={styles.sectionHeader}>
                <div><span>01</span><strong>{view === "ranked" ? "Highest-value signal" : "Latest lead signal"}</strong></div>
                <small>{filtered.length} matching items</small>
              </div>
              <StoryCard item={lead} emphasis />
              <div className={styles.supportGrid}>
                {supporting.map((item) => <StoryCard key={item.id} item={item} />)}
              </div>
            </div>

            <aside className={styles.wireColumn}>
              <div className={styles.sectionHeader}>
                <div><span>02</span><strong>Live wire</strong></div>
                <small>published time</small>
              </div>
              <div className={styles.wireList}>
                {wire.map((item) => <HeadlineRow key={`wire-${item.id}`} item={item} />)}
              </div>
            </aside>
          </section>
        ) : (
          <section className={styles.emptyState}>
            <strong>No matching signal.</strong>
            <p>Clear the search or try another topic pod. The live fallback will continue checking available feeds.</p>
            <Link href="/">Reset MotoCODEX</Link>
          </section>
        )}

        <section className={styles.lowerGrid}>
          <div className={styles.rankPanel}>
            <div className={styles.sectionHeader}>
              <div><span>03</span><strong>Signal ranking</strong></div>
              <small>importance + freshness</small>
            </div>
            <div>{rankedTop.map((item, index) => <HeadlineRow key={`rank-${item.id}`} item={item} rank={index + 1} />)}</div>
          </div>

          <div className={styles.ecosystemPanel}>
            <div className={styles.sectionHeader}>
              <div><span>04</span><strong>MotoINTELLIGENCE stack</strong></div>
            </div>
            <Link href="/feeds" className={styles.productCard}>
              <span>MotoFEEDS</span>
              <strong>Video and social signal</strong>
              <p>Unified YouTube and Instagram monitoring with source-level telemetry.</p>
              <b>Open feed →</b>
            </Link>
            <Link href="/motopedia" className={styles.productCard}>
              <span>MOTOPEDIA</span>
              <strong>Historical race memory</strong>
              <p>Results, riders, seasons, standings, and provenance rebuilt as a queryable library.</p>
              <b>Open library →</b>
            </Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>MotoCODEX · MotoINTELLIGENCE operating layer</span>
          <strong>Sources remain authoritative. MotoCODEX preserves the route back.</strong>
        </footer>
      </div>
    </main>
  );
}

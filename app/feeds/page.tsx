import Link from "next/link";
import MotoHeader from "@/components/MotoHeader";
import { filterMotoItems, getSocial, topTags, type MotoItem } from "@/lib/moto";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  q?: string;
  platform?: "all" | "youtube" | "instagram";
  tag?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Unknown publish time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown publish time";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function FeedCard({ item, large = false }: { item: MotoItem; large?: boolean }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className={large ? styles.largeCard : styles.feedCard}>
      <div className={styles.media}>
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className={styles.mediaFallback}>{item.platform === "youtube" ? "▶" : "◎"}</div>
        )}
        <span className={item.platform === "youtube" ? styles.youtubePill : styles.instagramPill}>{item.platform}</span>
      </div>
      <div className={styles.cardCopy}>
        <div className={styles.sourceLine}>
          <strong>{item.sourceName}</strong>
          <span>{formatDate(item.publishedAt || item.createdAt)}</span>
        </div>
        <h3>{item.title}</h3>
        <div className={styles.tags}>{item.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
      </div>
    </a>
  );
}

export default async function FeedsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = String(searchParams?.q ?? "").trim();
  const platform = searchParams?.platform === "youtube" || searchParams?.platform === "instagram" ? searchParams.platform : "all";
  const tag = String(searchParams?.tag ?? "all").trim().toLowerCase();

  const data = await getSocial(700);
  const filtered = filterMotoItems(data.items, { query, platform, tag });
  const tags = topTags(data.items, 16);
  const youtubeCount = data.items.filter((item) => item.platform === "youtube").length;
  const instagramCount = data.items.filter((item) => item.platform === "instagram").length;
  const lead = filtered[0];
  const gridItems = filtered.slice(lead ? 1 : 0);
  const sources = Array.from(new Set(data.items.map((item) => item.sourceName))).sort();

  const hrefWith = (patch: Partial<SearchParams>) => {
    const next = { q: query || undefined, platform, tag: tag === "all" ? undefined : tag, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.platform && next.platform !== "all") params.set("platform", next.platform);
    if (next.tag && next.tag !== "all") params.set("tag", next.tag);
    const value = params.toString();
    return value ? `/feeds?${value}` : "/feeds";
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <MotoHeader active="feeds" />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>VIDEO / SOCIAL / PODCAST SIGNAL</div>
            <h1>MotoFEEDS</h1>
            <p>
              One master feed for the creators, teams, riders, channels, and social sources shaping the moto conversation right now.
            </p>
            <form action="/feeds" className={styles.searchForm}>
              {platform !== "all" ? <input type="hidden" name="platform" value={platform} /> : null}
              {tag !== "all" ? <input type="hidden" name="tag" value={tag} /> : null}
              <input name="q" defaultValue={query} placeholder="Search creators, riders, videos, topics…" />
              <button type="submit">Search feed</button>
            </form>
          </div>

          <div className={styles.dashboard}>
            <div><strong>{data.items.length}</strong><span>posts loaded</span></div>
            <div><strong>{sources.length}</strong><span>active sources</span></div>
            <div><strong>{youtubeCount}</strong><span>YouTube</span></div>
            <div><strong>{instagramCount}</strong><span>Instagram</span></div>
            <div className={styles.modeCard}>
              <span>Feed transport</span>
              <strong>{data.mode === "supabase" ? "Historical social store" : data.mode === "live-rss" ? "Live RSS failover" : "Awaiting source data"}</strong>
              <small>Refreshed {new Date(data.fetchedAt).toLocaleTimeString()} · {data.sourceCount} sources responsive</small>
            </div>
          </div>
        </section>

        <section className={styles.controls}>
          <div className={styles.platformToggle}>
            <Link href={hrefWith({ platform: "all" })} className={platform === "all" ? styles.active : undefined}>All</Link>
            <Link href={hrefWith({ platform: "youtube" })} className={platform === "youtube" ? styles.active : undefined}>YouTube <span>{youtubeCount}</span></Link>
            <Link href={hrefWith({ platform: "instagram" })} className={platform === "instagram" ? styles.active : undefined}>Instagram <span>{instagramCount}</span></Link>
          </div>
          <div className={styles.tagRail}>
            <Link href={hrefWith({ tag: "all" })} className={tag === "all" ? styles.activeTag : undefined}>All topics</Link>
            {tags.map((entry) => (
              <Link key={entry.tag} href={hrefWith({ tag: entry.tag })} className={tag === entry.tag ? styles.activeTag : undefined}>
                {entry.tag}<span>{entry.count}</span>
              </Link>
            ))}
          </div>
        </section>

        {data.errors.length ? (
          <details className={styles.telemetry}>
            <summary>Feed telemetry · {data.errors.length} recoverable issue{data.errors.length === 1 ? "" : "s"}</summary>
            <div>{data.errors.slice(0, 10).map((error) => <p key={error}>{error}</p>)}</div>
          </details>
        ) : null}

        <section className={styles.sourceStrip}>
          <span>Sources in current window</span>
          <div>{sources.slice(0, 18).map((source) => <b key={source}>{source}</b>)}</div>
        </section>

        {lead ? (
          <>
            <section className={styles.leadSection}>
              <div className={styles.sectionHeading}>
                <div><span>01</span><strong>Latest signal</strong></div>
                <small>{filtered.length} items in this view</small>
              </div>
              <FeedCard item={lead} large />
            </section>

            <section className={styles.feedSection}>
              <div className={styles.sectionHeading}>
                <div><span>02</span><strong>Master moto feed</strong></div>
                <small>newest published first</small>
              </div>
              <div className={styles.feedGrid}>
                {gridItems.map((item) => <FeedCard key={item.id} item={item} />)}
              </div>
            </section>
          </>
        ) : (
          <section className={styles.emptyState}>
            <strong>No matching feed signal.</strong>
            <p>The selected source lane may be empty. Clear the filters to return to the combined feed.</p>
            <Link href="/feeds">Reset MotoFEEDS</Link>
          </section>
        )}

        <section className={styles.libraryBridge}>
          <div>
            <span>From signal to memory</span>
            <strong>MotoFEEDS captures what the moto world is saying now.</strong>
            <p>MOTOPEDIA preserves the durable facts—seasons, rounds, riders, results, standings, and source provenance—so the signal can become historical intelligence.</p>
          </div>
          <Link href="/motopedia">Open MOTOPEDIA →</Link>
        </section>

        <footer className={styles.footer}>
          <span>MotoFEEDS · MotoINTELLIGENCE social layer</span>
          <strong>Public posts remain owned and controlled by their source platforms.</strong>
        </footer>
      </div>
    </main>
  );
}

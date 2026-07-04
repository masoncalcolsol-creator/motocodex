import type { CSSProperties } from "react";
import { SPORTS, getSportFeed, type SportKey } from "../lib/sports-beta";
import { SportsPwa } from "./SportsPwa";
import styles from "./SportsBeta.module.css";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  sport: SportKey;
  searchParams?: SearchParams;
};

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(delta / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export async function SportsBeta({ sport, searchParams = {} }: Props) {
  const config = SPORTS[sport];
  const view = ["codex", "feeds", "app"].includes(single(searchParams.view)) ? single(searchParams.view) : "codex";
  const topic = single(searchParams.topic) || "Latest";
  const q = single(searchParams.q).trim().toLowerCase();
  const feed = await getSportFeed(sport);
  const filtered = feed.items.filter((item) => {
    const topicMatch = topic === "Latest" || item.tags.some((tag) => tag.toLowerCase() === topic.toLowerCase());
    const text = `${item.title} ${item.summary} ${item.source} ${item.tags.join(" ")}`.toLowerCase();
    return topicMatch && (!q || text.includes(q));
  });
  const items = filtered.length ? filtered : feed.items;
  const vars = {
    "--accent": config.accent,
    "--accent-2": config.accent2,
    "--glow": config.glow,
  } as CSSProperties;

  return (
    <main className={styles.page} style={vars}>
      <SportsPwa slug={config.slug} />
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <a className={styles.brand} href="/sports">
            <span className={styles.brandMark}>NW</span>
            <span><b>NULLWORKS</b><small>Sports Intelligence Beta</small></span>
          </a>
          <nav className={styles.sportNav} aria-label="Switch sport">
            {Object.values(SPORTS).map((entry) => (
              <a key={entry.slug} className={entry.slug === sport ? styles.sportActive : ""} href={`/${entry.slug}`}>{entry.short}</a>
            ))}
          </nav>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>{config.league} · Mobile Beta</div>
            <h1>{config.headline}</h1>
            <p>{config.description}</p>
            <form className={styles.search} action={`/${config.slug}`}>
              <input type="hidden" name="view" value={view} />
              <input type="search" name="q" defaultValue={single(searchParams.q)} placeholder={`Search ${config.short} headlines, people, teams...`} aria-label={`Search ${config.short}`} />
              <button type="submit">Search</button>
            </form>
          </div>
          <div className={styles.metrics}>
            <div><strong>{items.length}</strong><span>signals loaded</span></div>
            <div><strong>{config.sourceCount}</strong><span>source lanes</span></div>
            <div className={styles.modeCard}>
              <span className={feed.mode === "live" ? styles.liveDot : styles.fallbackDot} />
              <div><b>{feed.mode === "live" ? "PUBLIC FEED LIVE" : "SOURCE FALLBACK"}</b><small>Checked {new Date(feed.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" })} Arizona</small></div>
            </div>
          </div>
        </section>

        <section className={styles.controlDeck}>
          <div className={styles.productTabs}>
            <a className={view === "codex" ? styles.activeTab : ""} href={`/${config.slug}?view=codex`}>{config.codex}</a>
            <a className={view === "feeds" ? styles.activeTab : ""} href={`/${config.slug}?view=feeds`}>{config.feeds}</a>
            <a className={view === "app" ? styles.activeTab : ""} href={`/${config.slug}?view=app`}>{config.app}</a>
          </div>
          <div className={styles.topicStrip}>
            {config.topics.map((entry) => (
              <a key={entry} className={entry === topic ? styles.activeTopic : ""} href={`/${config.slug}?view=${view}&topic=${encodeURIComponent(entry)}`}>{entry}</a>
            ))}
          </div>
        </section>

        {view === "codex" && (
          <section className={styles.codexGrid}>
            <div className={styles.leadColumn}>
              <div className={styles.sectionTitle}><span>01</span><div><b>Command Brief</b><small>Newest public-source intelligence</small></div></div>
              {items[0] && <Story item={items[0]} featured />}
              <div className={styles.cardGrid}>{items.slice(1, 7).map((item) => <Story key={item.url} item={item} />)}</div>
            </div>
            <aside className={styles.sourcePanel}>
              <div className={styles.sectionTitle}><span>02</span><div><b>Source Registry</b><small>Direct verification lanes</small></div></div>
              {config.sources.map((source) => (
                <a key={source.href} className={styles.sourceLink} href={source.href} target="_blank" rel="noreferrer">
                  <span>{source.lane}</span><b>{source.name}</b><small>Open original ↗</small>
                </a>
              ))}
              <div className={styles.boundary}><b>Beta boundary</b><p>Public news discovery only. No licensed real-time scores, private social APIs, paywall bypass, betting execution, or automated sports decisions.</p></div>
            </aside>
          </section>
        )}

        {view === "feeds" && (
          <section className={styles.feedPanel}>
            <div className={styles.sectionTitle}><span>01</span><div><b>{config.feeds} Wire</b><small>Fast scan · tap through to source</small></div></div>
            <div className={styles.wireList}>{items.map((item, index) => <Wire key={`${item.url}-${index}`} item={item} rank={index + 1} />)}</div>
          </section>
        )}

        {view === "app" && (
          <section className={styles.appGrid}>
            <div className={styles.phone}>
              <div className={styles.phoneTop}><span>{config.short}</span><b>{config.app}</b><small>{feed.mode === "live" ? "LIVE" : "FALLBACK"}</small></div>
              <div className={styles.phoneFeed}>{items.slice(0, 6).map((item) => (
                <a key={item.url} href={item.url} target="_blank" rel="noreferrer"><small>{item.source} · {timeAgo(item.publishedAt)}</small><b>{item.title}</b></a>
              ))}</div>
              <div className={styles.phoneNav}><span>CODEX</span><b>FEED</b><span>SOURCES</span></div>
            </div>
            <div className={styles.installCard}>
              <div className={styles.eyebrow}>Installable mobile surface</div>
              <h2>Put {config.app} on your home screen.</h2>
              <p>Android Chrome: open the browser menu and tap <b>Install app</b> or <b>Add to Home screen</b>. iPhone Safari: tap Share, then <b>Add to Home Screen</b>.</p>
              <div className={styles.installSteps}><span>1 · Open this URL in your browser</span><span>2 · Add it to your home screen</span><span>3 · Beta the CODEX, FEEDS, search, source links, and refresh behavior</span></div>
              <a className={styles.launchButton} href={`/${config.slug}?view=feeds`}>Launch live feed</a>
            </div>
          </section>
        )}

        <footer className={styles.footer}>
          <span>NULLWORKS · {config.codex} · {config.feeds}</span>
          <strong>Human judgment remains final.</strong>
        </footer>
      </div>
    </main>
  );
}

function Story({ item, featured = false }: { item: Awaited<ReturnType<typeof getSportFeed>>["items"][number]; featured?: boolean }) {
  return <a className={`${styles.story} ${featured ? styles.featured : ""}`} href={item.url} target="_blank" rel="noreferrer">
    <div className={styles.storyMeta}><span>{item.source}</span><i />{timeAgo(item.publishedAt)}</div>
    <h2>{item.title}</h2>
    <p>{item.summary}</p>
    <div className={styles.tags}>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
  </a>;
}

function Wire({ item, rank }: { item: Awaited<ReturnType<typeof getSportFeed>>["items"][number]; rank: number }) {
  return <a className={styles.wire} href={item.url} target="_blank" rel="noreferrer">
    <span className={styles.rank}>{String(rank).padStart(2, "0")}</span>
    <div><small>{item.source} · {timeAgo(item.publishedAt)}</small><b>{item.title}</b><p>{item.summary}</p></div>
    <span className={styles.arrow}>↗</span>
  </a>;
}

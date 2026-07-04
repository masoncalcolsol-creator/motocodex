import { XMLParser } from "fast-xml-parser";

export type SportKey = "mlb" | "npb" | "nfl" | "nhl" | "nascar" | "ufc";

export type FeedItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  tags: string[];
};

type SportConfig = {
  slug: SportKey;
  short: string;
  codex: string;
  feeds: string;
  app: string;
  league: string;
  headline: string;
  description: string;
  query: string;
  accent: string;
  accent2: string;
  glow: string;
  sourceCount: number;
  topics: string[];
  sources: { name: string; href: string; lane: string }[];
};

export const SPORTS: Record<SportKey, SportConfig> = {
  mlb: {
    slug: "mlb", short: "MLB", codex: "MLBCODEX", feeds: "MLBFEEDS", app: "MLB Feed App",
    league: "Major League Baseball", headline: "The baseball intelligence desk.",
    description: "News, transactions, injuries, prospects, standings context, and public-source baseball signals in one mobile command surface.",
    query: 'Major League Baseball MLB trade injury prospect', accent: "#ff4f64", accent2: "#4797ff", glow: "rgba(255,79,100,.2)", sourceCount: 10,
    topics: ["Latest", "Transactions", "Injuries", "Prospects", "Standings", "Postseason"],
    sources: [
      {name:"MLB",href:"https://www.mlb.com/news",lane:"Official"},{name:"ESPN MLB",href:"https://www.espn.com/mlb/",lane:"News"},{name:"Baseball Reference",href:"https://www.baseball-reference.com/",lane:"Reference"},{name:"FanGraphs",href:"https://www.fangraphs.com/",lane:"Analysis"}
    ]
  },
  npb: {
    slug: "npb", short: "NPB", codex: "NPBCODEX", feeds: "NPBFEEDS", app: "NPB Feed App",
    league: "Nippon Professional Baseball", headline: "Japan baseball, translated into signal.",
    description: "NPB club news, player movement, standings context, international crossover, and public Japanese baseball discovery feeds.",
    query: 'Nippon Professional Baseball NPB Japanese baseball', accent: "#ff87a8", accent2: "#756cff", glow: "rgba(255,135,168,.2)", sourceCount: 10,
    topics: ["Latest", "Central", "Pacific", "Players", "MLB Watch", "Japan Series"],
    sources: [
      {name:"NPB.jp",href:"https://npb.jp/eng/",lane:"Official"},{name:"The Japan Times",href:"https://www.japantimes.co.jp/sports/baseball/",lane:"News"},{name:"Pacific League",href:"https://pacificleague.com/",lane:"League"},{name:"Baseball Reference Japan",href:"https://www.baseball-reference.com/register/league.cgi?code=JPPL&class=Fgn",lane:"Reference"}
    ]
  },
  nfl: {
    slug: "nfl", short: "NFL", codex: "NFLCODEX", feeds: "NFLFEEDS", app: "NFL Feed App",
    league: "National Football League", headline: "Every roster move. One war room.",
    description: "NFL news, depth-chart movement, injuries, contracts, draft context, and public-source league intelligence optimized for mobile.",
    query: 'NFL football trade injury roster draft', accent: "#d9ff35", accent2: "#f5f5f5", glow: "rgba(217,255,53,.17)", sourceCount: 10,
    topics: ["Latest", "Roster", "Injuries", "Contracts", "Draft", "Fantasy"],
    sources: [
      {name:"NFL",href:"https://www.nfl.com/news/",lane:"Official"},{name:"ESPN NFL",href:"https://www.espn.com/nfl/",lane:"News"},{name:"Pro Football Reference",href:"https://www.pro-football-reference.com/",lane:"Reference"},{name:"Over The Cap",href:"https://overthecap.com/",lane:"Contracts"}
    ]
  },
  nhl: {
    slug: "nhl", short: "NHL", codex: "NHLCODEX", feeds: "NHLFEEDS", app: "NHL Feed App",
    league: "National Hockey League", headline: "Cold data. Fast hockey signal.",
    description: "NHL news, injuries, line changes, trades, prospects, and playoff context in a crisp ice-themed mobile intelligence feed.",
    query: 'NHL hockey trade injury prospect playoffs', accent: "#68e7ff", accent2: "#dffaff", glow: "rgba(104,231,255,.18)", sourceCount: 10,
    topics: ["Latest", "Trades", "Injuries", "Lines", "Prospects", "Playoffs"],
    sources: [
      {name:"NHL",href:"https://www.nhl.com/news",lane:"Official"},{name:"ESPN NHL",href:"https://www.espn.com/nhl/",lane:"News"},{name:"Hockey Reference",href:"https://www.hockey-reference.com/",lane:"Reference"},{name:"CapFriendly Archive",href:"https://www.capfriendly.com/",lane:"Contracts"}
    ]
  },
  nascar: {
    slug: "nascar", short: "NASCAR", codex: "NASCARCODEX", feeds: "NASCARFEEDS", app: "NASCAR Feed App",
    league: "NASCAR", headline: "Race-week intelligence at full throttle.",
    description: "Cup, Xfinity, Trucks, garage news, penalties, driver movement, qualifying context, and public racing signals.",
    query: 'NASCAR Cup Series racing driver penalty qualifying', accent: "#ff7a1a", accent2: "#ffd37a", glow: "rgba(255,122,26,.2)", sourceCount: 10,
    topics: ["Latest", "Cup", "Xfinity", "Trucks", "Garage", "Results"],
    sources: [
      {name:"NASCAR",href:"https://www.nascar.com/news-media/",lane:"Official"},{name:"Motorsport",href:"https://www.motorsport.com/nascar-cup/",lane:"News"},{name:"Jayski",href:"https://www.jayski.com/",lane:"Garage"},{name:"Racing Reference",href:"https://www.racing-reference.info/",lane:"Reference"}
    ]
  },
  ufc: {
    slug: "ufc", short: "UFC", codex: "UFCCODEX", feeds: "UFCFEEDS", app: "UFC Feed App",
    league: "Ultimate Fighting Championship", headline: "Fight intelligence without the noise.",
    description: "UFC cards, fighter news, injuries, rankings context, weigh-ins, results, and public combat-sports signals in one feed.",
    query: 'UFC MMA fight card fighter injury rankings', accent: "#ff3c42", accent2: "#ffb1a5", glow: "rgba(255,60,66,.2)", sourceCount: 11,
    topics: ["Latest", "Fight Cards", "Fighters", "Rankings", "Weigh-ins", "Results"],
    sources: [
      {name:"UFC",href:"https://www.ufc.com/news",lane:"Official"},{name:"ESPN MMA",href:"https://www.espn.com/mma/",lane:"News"},{name:"MMA Fighting",href:"https://www.mmafighting.com/",lane:"News"},{name:"Tapology",href:"https://www.tapology.com/",lane:"Reference"}
    ]
  }
};

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function sourceFromTitle(title: string): { title: string; source: string } {
  const split = title.split(" - ");
  if (split.length < 2) return { title, source: "Public news feed" };
  return { title: split.slice(0, -1).join(" - "), source: split[split.length - 1] };
}

function fallbackItems(config: SportConfig): FeedItem[] {
  return config.sources.map((source, index) => ({
    title: `${config.short} ${source.lane} lane ready for beta review`,
    url: source.href,
    source: source.name,
    publishedAt: new Date(Date.now() - index * 3600000).toISOString(),
    summary: `Open the ${source.name} source lane while the public discovery feed reconnects. The beta preserves direct source access instead of inventing a live headline.`,
    tags: [source.lane, config.short]
  }));
}

export async function getSportFeed(sport: SportKey): Promise<{ items: FeedItem[]; mode: "live" | "fallback"; checkedAt: string }> {
  const config = SPORTS[sport];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(config.query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const response = await fetch(url, { next: { revalidate: 300 }, headers: { "User-Agent": "NULLWORKS-Sports-Beta/1.0" } });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const xml = await response.text();
    const parsed = parser.parse(xml);
    const rows = asArray<any>(parsed?.rss?.channel?.item).slice(0, 24);
    const items = rows.map((row, index): FeedItem => {
      const rawTitle = String(row?.title || `${config.short} update`);
      const separated = sourceFromTitle(rawTitle);
      const description = stripHtml(String(row?.description || ""));
      return {
        title: separated.title,
        url: String(row?.link || config.sources[index % config.sources.length].href),
        source: separated.source,
        publishedAt: new Date(row?.pubDate || Date.now() - index * 1800000).toISOString(),
        summary: description || `Public-source ${config.short} update. Open the original report for full context and verification.`,
        tags: [config.topics[(index % (config.topics.length - 1)) + 1], config.short]
      };
    }).filter((item) => item.title && item.url);
    if (!items.length) throw new Error("No items parsed");
    return { items, mode: "live", checkedAt: new Date().toISOString() };
  } catch {
    return { items: fallbackItems(config), mode: "fallback", checkedAt: new Date().toISOString() };
  }
}

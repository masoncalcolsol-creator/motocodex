// FILE: C:\MotoCODEX\app\api\ingest\feeds.ts
// Create this NEW file.
//
// Notes:
// - "url" can be direct RSS or an RSS.app generated feed.
// - Prefer RSS.app for sites that block server fetches (RacerX sometimes 403; SupercrossLive usually has no RSS).
// - tier: 1 = weight up, 2 = normal, 3 = weight down (press releases / promo / noisy)

export type FeedDef = {
  key: string;
  name: string;
  url: string;
  tier: 1 | 2 | 3;
};

export const FEEDS: FeedDef[] = [
  // =========================
  // TIER 1 (Weight Up)
  // =========================

  // Racer X — direct feed exists but may block server fetches in some environments.
  // If you see 403 in ingest breakdown, replace with your RSS.app mirror URL.
  { key: "racerx_posts", name: "Racer X", url: "https://racerxonline.com/feeds/rss/posts", tier: 1 },

  // SupercrossLive — typically no clean RSS; use RSS.app mirror generated from:
  // https://www.supercrosslive.com/news/
  // Replace the placeholder URL with your RSS.app feed URL.
  { key: "supercrosslive_news", name: "SupercrossLive", url: "https://rss.app/feeds/REPLACE_ME_SUPERCROSSLIVE.xml", tier: 1 },

  // Cycle News — often easiest via RSS.app mirror(s)
  // Replace placeholders with RSS.app feeds you generate (root + /category/ racing pages you care about).
  { key: "cyclenews_root", name: "Cycle News", url: "https://rss.app/feeds/REPLACE_ME_CYCLENEWS.xml", tier: 1 },

  // PulpMX (WP feed)
  { key: "pulpmx", name: "PulpMX", url: "https://pulpmx.com/feed", tier: 1 },

  // =========================
  // TIER 2 (Normal)
  // =========================
  { key: "dirtbike", name: "Dirt Bike Magazine", url: "https://dirtbikemagazine.com/feed", tier: 2 },
  { key: "mxa", name: "Motocross Action", url: "https://motocrossactionmag.com/feed", tier: 2 },
  { key: "mxvice", name: "MX Vice", url: "https://mxvice.com/feed", tier: 2 },
  { key: "mxsports", name: "MX Sports Pro Racing", url: "https://mxsportsproracing.com/feeds/posts/default?alt=rss", tier: 2 },
  { key: "gatedrop", name: "GateDrop", url: "https://gatedrop.com/feed", tier: 2 },
  { key: "directmx", name: "Direct Motocross", url: "https://directmotocross.com/feed", tier: 2 },

  // =========================
  // TIER 3 (Weight Down / Optional)
  // =========================
  { key: "motocrosspress", name: "Motocross Press (PR)", url: "https://motocrosspress.blogspot.com/feeds/posts/default?alt=rss", tier: 3 },
];
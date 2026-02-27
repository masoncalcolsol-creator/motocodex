// FILE: C:\MotoCODEX\app\api\ingest\feeds.ts
// Replace the ENTIRE file with this.
//
// Change:
// - FeedDef now supports urls: string[] (try in order).
// - VitalMX added with a direct feed plus RSS.app fallback placeholder.
// - Keep tiers as your Phase 2 anti-monoculture lever.

export type FeedDef = {
  key: string;
  name: string;
  urls: string[];   // try in order until one works
  tier: 1 | 2 | 3;
};

export const FEEDS: FeedDef[] = [
  // =========================
  // TIER 1 (Weight Up)
  // =========================

  // Racer X — direct feed exists but may block server fetches sometimes.
  { key: "racerx_posts", name: "Racer X", tier: 1, urls: [
    "https://racerxonline.com/feeds/rss/posts",
    "https://rss.app/feeds/REPLACE_ME_RACERX.xml",
  ]},

  // VitalMX — direct feed exists; if blocked/empty, RSS.app mirror is the stable fix.
  // Known feed commonly referenced: https://feeds.vitalmx.com/vitalmxhomepage?format=xml
  { key: "vitalmx", name: "VitalMX", tier: 1, urls: [
    "https://feeds.vitalmx.com/vitalmxhomepage?format=xml",
    "https://rss.app/feeds/REPLACE_ME_VITALMX.xml",
  ]},

  // SupercrossLive — usually no clean RSS; use RSS.app mirror generated from https://www.supercrosslive.com/news/
  { key: "supercrosslive_news", name: "SupercrossLive", tier: 1, urls: [
    "https://rss.app/feeds/REPLACE_ME_SUPERCROSSLIVE.xml",
  ]},

  // Cycle News — easiest via RSS.app mirror(s)
  { key: "cyclenews_root", name: "Cycle News", tier: 1, urls: [
    "https://rss.app/feeds/REPLACE_ME_CYCLENEWS.xml",
  ]},

  // PulpMX (WP feed)
  { key: "pulpmx", name: "PulpMX", tier: 1, urls: [
    "https://pulpmx.com/feed",
  ]},

  // =========================
  // TIER 2 (Normal)
  // =========================
  { key: "dirtbike", name: "Dirt Bike Magazine", tier: 2, urls: ["https://dirtbikemagazine.com/feed"] },
  { key: "mxa", name: "Motocross Action", tier: 2, urls: ["https://motocrossactionmag.com/feed"] },
  { key: "mxvice", name: "MX Vice", tier: 2, urls: ["https://mxvice.com/feed"] },
  { key: "mxsports", name: "MX Sports Pro Racing", tier: 2, urls: ["https://mxsportsproracing.com/feeds/posts/default?alt=rss"] },
  { key: "gatedrop", name: "GateDrop", tier: 2, urls: ["https://gatedrop.com/feed"] },
  { key: "directmx", name: "Direct Motocross", tier: 2, urls: ["https://directmotocross.com/feed"] },

  // =========================
  // TIER 3 (Weight Down / Optional)
  // =========================
  { key: "motocrosspress", name: "Motocross Press (PR)", tier: 3, urls: ["https://motocrosspress.blogspot.com/feeds/posts/default?alt=rss"] },
];
// FILE: C:\MotoCODEX\app\api\ingest\feeds.ts
// Replace the ENTIRE file with this.
//
// Notes:
// - YouTube channel ingestion uses RSS: https://www.youtube.com/feeds/videos.xml?channel_id=...
// - You must replace REPLACE_CHANNEL_ID_* placeholders with real channel IDs.
//   (Channel IDs look like: UCxxxxxxxxxxxxxxxxxxxxxx)

export type FeedDef = {
  key: string;
  name: string;
  urls: string[];
  tier: 1 | 2 | 3;
  kind?: "rss" | "youtube";
};

export const FEEDS: FeedDef[] = [
  // =========================
  // TIER 1 (Weight Up)
  // =========================

  { key: "racerx_posts", name: "Racer X", tier: 1, kind: "rss", urls: [
    "https://racerxonline.com/feeds/rss/posts",
    "https://rss.app/feeds/REPLACE_ME_RACERX.xml",
  ]},

  { key: "vitalmx", name: "VitalMX", tier: 1, kind: "rss", urls: [
    "https://feeds.vitalmx.com/vitalmxhomepage?format=xml",
    "https://rss.app/feeds/REPLACE_ME_VITALMX.xml",
  ]},

  { key: "supercrosslive_news", name: "SupercrossLive", tier: 1, kind: "rss", urls: [
    "https://rss.app/feeds/REPLACE_ME_SUPERCROSSLIVE.xml",
  ]},

  { key: "cyclenews_root", name: "Cycle News", tier: 1, kind: "rss", urls: [
    "https://rss.app/feeds/REPLACE_ME_CYCLENEWS.xml",
  ]},

  { key: "pulpmx", name: "PulpMX", tier: 1, kind: "rss", urls: [
    "https://pulpmx.com/feed",
  ]},

  // =========================
  // YOUTUBE (Tiered)
  // =========================
  // Replace the channel IDs. You can add/remove channels freely.
  // Tip: we keep YouTube keys distinct so we can weight + cap independently later.

  { key: "yt_vitalmx", name: "Vital MX (YouTube)", tier: 1, kind: "youtube", urls: [
    "https://rss.app/feeds/eEJ0JEjmJHAQvd5j.xml"
  ]},

  { key: "yt_racerx", name: "Racer X (YouTube)", tier: 1, kind: "youtube", urls: [
    "https://rss.app/feeds/jn29gpgjQIhmLUZb.xml"
  ]},

  { key: "yt_maineventmoto", name: "Main Event Moto (YouTube)", tier: 2, kind: "youtube", urls: [
    "https://rss.app/feeds/K5nHxSHCDnctzH01.xml"
  ]},

  { key: "yt_mattburkeen", name: "Matt Burkeen (YouTube)", tier: 2, kind: "youtube", urls: [
    "https://rss.app/feeds/K1Q4dPeXaIE44PuN.xml"
  ]},

  // Add more:
  // { key: "yt_pulpmx", name: "PulpMX (YouTube)", tier: 1, kind: "youtube", urls: ["https://www.youtube.com/feeds/videos.xml?channel_id=..."] },

  // =========================
  // TIER 2 (Normal)
  // =========================
  { key: "dirtbike", name: "Dirt Bike Magazine", tier: 2, kind: "rss", urls: ["https://dirtbikemagazine.com/feed"] },
  { key: "mxa", name: "Motocross Action", tier: 2, kind: "rss", urls: ["https://motocrossactionmag.com/feed"] },
  { key: "mxvice", name: "MX Vice", tier: 2, kind: "rss", urls: ["https://mxvice.com/feed"] },
  { key: "mxsports", name: "MX Sports Pro Racing", tier: 2, kind: "rss", urls: ["https://mxsportsproracing.com/feeds/posts/default?alt=rss"] },
  { key: "gatedrop", name: "GateDrop", tier: 2, kind: "rss", urls: ["https://gatedrop.com/feed"] },
  { key: "directmx", name: "Direct Motocross", tier: 2, kind: "rss", urls: ["https://directmotocross.com/feed"] },

  // =========================
  // TIER 3 (Weight Down / Optional)
  // =========================
  { key: "motocrosspress", name: "Motocross Press (PR)", tier: 3, kind: "rss", urls: ["https://motocrosspress.blogspot.com/feeds/posts/default?alt=rss"] },
];
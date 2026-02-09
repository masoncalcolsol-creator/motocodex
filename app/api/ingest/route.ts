import { NextResponse } from "next/server";
import RSSParser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------- SUPABASE ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ---------- FEED DEFINITIONS ----------
type Feed = {
  name: string;
  url: string;     // RSS OR YouTube channel URL
  series: string;  // MX / SX / SMX / Video
};

const FEEDS: Feed[] = [
  // ---- Traditional RSS (known to work) ----
  { name: "MXA", url: "https://www.motocrossactionmag.com/feed/", series: "MX" },

  // ---- YouTube Channels ----
  { name: "VitalMX (YouTube)", url: "https://www.youtube.com/@vitalmx", series: "Video" },
  { name: "Live Motocross", url: "https://www.youtube.com/c/livemotocross", series: "Video" },
  { name: "Whiskey Throttle", url: "https://www.youtube.com/@whiskeythrottlemedia", series: "Video" },
  { name: "SwapMoto Live", url: "https://www.youtube.com/@swapmotolive", series: "Video" },
  { name: "PulpMX (YouTube)", url: "https://www.youtube.com/@PulpMX", series: "Video" },
  { name: "Racer X Illustrated", url: "https://www.youtube.com/@RacerXIllustrated", series: "Video" },
  { name: "SuperMotocross", url: "https://www.youtube.com/@supermotocross", series: "Video" },
];

// ---------- HELPERS ----------
const parser = new RSSParser({
  timeout: 15000,
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome Safari",
  },
});

function clean(v: any) {
  return String(v ?? "").trim();
}

function pickUrl(item: any) {
  return clean(item.link || item.id || item.guid || item?.links?.[0]?.url);
}

function pickTitle(item: any) {
  return clean(item.title || item.contentSnippet || item.content);
}

function isYouTube(u: string) {
  return u.includes("youtube.com") || u.includes("youtu.be");
}

function isYouTubeFeed(u: string) {
  return u.includes("youtube.com/feeds/videos.xml");
}

async function resolveYouTubeFeed(url: string) {
  if (isYouTubeFeed(url)) return url;

  // channel URL
  const channelMatch = url.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
  if (channelMatch) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`;
  }

  // handle/custom URL → scrape channelId
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube fetch failed ${res.status}`);

  const html = await res.text();
  const idMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
  if (!idMatch) throw new Error("channelId not found");

  return `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`;
}

// ---------- ROUTE ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!secret || secret !== process.env.INGEST_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results: any[] = [];
  let totalAdded = 0;

  for (const feed of FEEDS) {
    let feedUrl = feed.url;
    let seen = 0;
    let added = 0;

    try {
      if (isYouTube(feedUrl)) {
        feedUrl = await resolveYouTubeFeed(feedUrl);
      }

      const parsed = await parser.parseURL(feedUrl);

      for (const item of (parsed.items || []).slice(0, 20)) {
        const title = pickTitle(item);
        const url = pickUrl(item);
        if (!title || !url) continue;

        seen++;

        const { error } = await supabase
          .from("posts")
          .upsert(
            {
              title,
              url,
              source: feed.name,
              series: feed.series,
            },
            { onConflict: "url" }
          );

        if (!error) {
          added++;
          totalAdded++;
        }
      }

      results.push({ source: feed.name, series: feed.series, seen, added });
    } catch (e: any) {
      results.push({
        source: feed.name,
        series: feed.series,
        error: e?.message || String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalAdded,
    feeds: results,
  });
}

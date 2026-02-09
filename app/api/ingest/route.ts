import { NextRequest } from "next/server";
import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type FeedDef = {
  url: string;
  source: string;
  series: string;
  type: "rss" | "youtube";
};

/**
 * Resolve a YouTube URL to a videos RSS feed URL.
 * Supports:
 * - https://www.youtube.com/@handle
 * - https://www.youtube.com/c/customName
 * - https://www.youtube.com/channel/UCxxxx
 */
async function youtubeToRss(url: string): Promise<{ rssUrl: string; channelId?: string }> {
  // If already a channel URL with UC id
  const channelMatch = url.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
  if (channelMatch?.[1]) {
    const channelId = channelMatch[1];
    return { rssUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, channelId };
  }

  // Fetch the page and extract channelId
  const res = await fetch(url, {
    // Some YT pages behave better with a UA
    headers: { "user-agent": "Mozilla/5.0" },
    // Prevent any caching weirdness on serverless
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`YouTube page fetch failed (${res.status})`);
  }

  const html = await res.text();

  // Common patterns containing channelId
  const m1 = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
  const m2 = html.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);

  const channelId = m1?.[1] || m2?.[1];
  if (!channelId) {
    throw new Error("channelId not found");
  }

  return { rssUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, channelId };
}

export async function GET(req: NextRequest) {
  // --- auth (secret) ---
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.INGEST_SECRET) {
    return new Response("Server misconfigured: INGEST_SECRET missing", { status: 500 });
  }
  if (secret !== process.env.INGEST_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // --- env sanity checks ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return new Response("Server misconfigured: NEXT_PUBLIC_SUPABASE_URL missing", { status: 500 });
  }
  if (!serviceKey) {
    return new Response("Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const parser = new Parser({
    timeout: 15000,
    headers: { "user-agent": "Mozilla/5.0" },
  });

  // --- feeds ---
  const feeds: FeedDef[] = [
    { url: "https://www.motocrossactionmag.com/feed/", source: "MXA", series: "MX", type: "rss" },

    // VitalMX RSS (currently throws parse error for you; we keep it so you can see it)
    { url: "https://www.vitalmx.com/rss.xml", source: "VitalMX", series: "MX", type: "rss" },

    // YouTube channels
    { url: "https://www.youtube.com/@vitalmx", source: "VitalMX (YouTube)", series: "Video", type: "youtube" },
    { url: "https://www.youtube.com/c/livemotocross", source: "Live Motocross", series: "Video", type: "youtube" },
    { url: "https://www.youtube.com/@whiskeythrottlemedia", source: "Whiskey Throttle", series: "Video", type: "youtube" },
    { url: "https://www.youtube.com/@swapmotolive", source: "SwapMoto Live", series: "Video", type: "youtube" },
    { url: "https://www.youtube.com/@PulpMX", source: "PulpMX (YouTube)", series: "Video", type: "youtube" },
    { url: "https://www.youtube.com/@RacerXIllustrated", source: "Racer X Illustrated", series: "Video", type: "youtube" },
    { url: "https://www.youtube.com/@supermotocross", source: "SuperMotocross", series: "Video", type: "youtube" },
  ];

  let totalSeen = 0;
  let totalUpserted = 0;

  const perFeed: any[] = [];

  for (const feed of feeds) {
    const feedReport: any = {
      url: feed.url,
      source: feed.source,
      series: feed.series,
      seen: 0,
      upserted: 0,
    };

    try {
      // Convert YouTube URL -> RSS videos.xml
      let fetchUrl = feed.url;
      if (feed.type === "youtube") {
        const { rssUrl, channelId } = await youtubeToRss(feed.url);
        fetchUrl = rssUrl;
        feedReport.resolved = { rssUrl, channelId };
      }

      const parsed = await parser.parseURL(fetchUrl);

      const items = (parsed.items || []).slice(0, 15);
      feedReport.seen = items.length;
      totalSeen += items.length;

      const itemErrors: any[] = [];

      for (const item of items) {
        const title = (item.title || "").trim();
        const link = (item.link || item.guid || "").trim();
        if (!title || !link) continue;

        const { error } = await supabase.from("posts").upsert(
          {
            title,
            url: link,
            source: feed.source,
            series: feed.series,
          },
          { onConflict: "url" }
        );

        if (error) {
          itemErrors.push({ url: link, message: error.message });
        } else {
          feedReport.upserted += 1;
          totalUpserted += 1;
        }
      }

      if (itemErrors.length) {
        // include only first few to avoid huge payloads
        feedReport.supabaseErrors = itemErrors.slice(0, 5);
        feedReport.supabaseErrorCount = itemErrors.length;
      }
    } catch (e: any) {
      feedReport.error = e?.message || String(e);
    }

    perFeed.push(feedReport);
  }

  return Response.json({
    ok: true,
    totals: { totalSeen, totalUpserted },
    perFeed,
  });
}

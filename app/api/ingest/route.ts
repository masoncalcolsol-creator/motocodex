// app/api/ingest/route.ts
import RSSParser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Feed =
  | { kind: "rss"; url: string; source: string; series: string }
  | { kind: "youtube"; channelUrl: string; source: string; series: string };

const FEEDS: Feed[] = [
  // RSS (articles)
  { kind: "rss", url: "https://www.motocrossactionmag.com/feed/", source: "MXA", series: "MX" },
  { kind: "rss", url: "https://www.vitalmx.com/rss.xml", source: "VitalMX", series: "MX" },

  // YouTube (videos) — handles are OK
  { kind: "youtube", channelUrl: "https://www.youtube.com/@vitalmx", source: "VitalMX (YouTube)", series: "Video" },
  { kind: "youtube", channelUrl: "https://www.youtube.com/c/livemotocross", source: "Live Motocross", series: "Video" },
  { kind: "youtube", channelUrl: "https://www.youtube.com/@whiskeythrottlemedia", source: "Whiskey Throttle", series: "Video" },
  { kind: "youtube", channelUrl: "https://www.youtube.com/@swapmotolive", source: "SwapMoto Live", series: "Video" },
  { kind: "youtube", channelUrl: "https://www.youtube.com/@PulpMX", source: "PulpMX (YouTube)", series: "Video" },
  { kind: "youtube", channelUrl: "https://www.youtube.com/@RacerXIllustrated", source: "Racer X Illustrated", series: "Video" },
  { kind: "youtube", channelUrl: "https://www.youtube.com/@supermotocross", source: "SuperMotocross", series: "Video" },
];

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function normalizeUrl(u: string) {
  // remove tracking params that create duplicates
  try {
    const url = new URL(u);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) =>
      url.searchParams.delete(k)
    );
    return url.toString();
  } catch {
    return u;
  }
}

async function resolveYouTubeFeedUrl(channelUrl: string): Promise<string> {
  // Already a feed URL?
  if (channelUrl.includes("youtube.com/feeds/videos.xml")) return channelUrl;

  // /channel/UCxxxx
  const m = channelUrl.match(/youtube\.com\/channel\/(UC[0-9A-Za-z_-]{10,})/);
  if (m?.[1]) return `https://www.youtube.com/feeds/videos.xml?channel_id=${m[1]}`;

  // Handle or custom URL: fetch page and extract channelId
  const res = await fetch(channelUrl, {
    headers: {
      // give YouTube a normal UA to avoid some bot blocks
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`YouTube page fetch failed (${res.status})`);

  const html = await res.text();

  // common patterns in YouTube HTML
  const r1 = html.match(/"channelId":"(UC[0-9A-Za-z_-]{10,})"/);
  const r2 = html.match(/https:\/\/www\.youtube\.com\/channel\/(UC[0-9A-Za-z_-]{10,})/);

  const channelId = r1?.[1] || r2?.[1];
  if (!channelId) throw new Error("channelId not found");

  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

export async function GET(request: Request) {
  try {
    const secret = new URL(request.url).searchParams.get("secret") || "";
    const expected = env("INGEST_SECRET");
    if (secret !== expected) return new Response("Unauthorized", { status: 401 });

    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const parser = new RSSParser();

    let totalSeen = 0;
    let totalUpserted = 0;

    const perFeed: Array<{
      url: string;
      source: string;
      series: string;
      seen: number;
      upserted: number;
      error?: string;
    }> = [];

    for (const feed of FEEDS) {
      const metaUrl = feed.kind === "rss" ? feed.url : feed.channelUrl;
      let seen = 0;
      let upserted = 0;

      try {
        const feedUrl =
          feed.kind === "rss" ? feed.url : await resolveYouTubeFeedUrl(feed.channelUrl);

        const parsed = await parser.parseURL(feedUrl);
        const items = (parsed.items || []).slice(0, 15);

        for (const item of items) {
          const title = (item.title || "").trim();
          const link = normalizeUrl(((item.link as string) || "").trim());

          if (!title || !link) continue;

          seen++;
          totalSeen++;

          const { error } = await supabase
            .from("posts")
            .upsert(
              {
                title,
                url: link,
                source: feed.source,
                series: feed.series,
              },
              { onConflict: "url" }
            );

          if (!error) {
            upserted++;
            totalUpserted++;
          }
        }

        perFeed.push({
          url: metaUrl,
          source: feed.source,
          series: feed.series,
          seen,
          upserted,
        });
      } catch (e: any) {
        perFeed.push({
          url: metaUrl,
          source: feed.source,
          series: feed.series,
          seen,
          upserted,
          error: e?.message || String(e),
        });
      }
    }

    return Response.json({
      ok: true,
      totals: { totalSeen, totalUpserted },
      perFeed,
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import RSSParser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const parser = new RSSParser();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Feed = { url: string; source: string; series: string };

const FEEDS: Feed[] = [
  { url: "https://www.motocrossactionmag.com/feed/", source: "MXA", series: "MX" },

  // These may fail (some sites block bots / RSS)
  { url: "https://racerxonline.com/rss", source: "RacerX", series: "MX" },
  { url: "https://www.vitalmx.com/rss.xml", source: "VitalMX", series: "MX" },
  { url: "https://www.swapmoto.com/feed/", source: "SwapMoto", series: "MX" },
  { url: "https://www.pulpmx.com/feed/", source: "PulpMX", series: "SX" },
  { url: "https://www.dirtrider.com/feed", source: "DirtRider", series: "MX" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!secret || secret !== process.env.INGEST_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const perFeed: Array<{
    source: string;
    series: string;
    url: string;
    seen: number;
    upserted: number;
    error?: string;
  }> = [];

  let totalSeen = 0;
  let totalUpserted = 0;

  for (const feed of FEEDS) {
    let seen = 0;
    let upserted = 0;

    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of (parsed.items || []).slice(0, 20)) {
        const title = (item.title || "").trim();
        const link = (item.link || item.guid || "").trim();
        if (!title || !link) continue;

        seen++;
        totalSeen++;

        const { error } = await supabase
          .from("posts")
          .upsert(
            { title, url: link, source: feed.source, series: feed.series },
            { onConflict: "url" }
          );

        if (!error) {
          upserted++;
          totalUpserted++;
        }
      }

      perFeed.push({ ...feed, seen, upserted });
    } catch (e: any) {
      perFeed.push({
        ...feed,
        seen,
        upserted,
        error: e?.message || String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totals: { totalSeen, totalUpserted },
    perFeed,
  });
}

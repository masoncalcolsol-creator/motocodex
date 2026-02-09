import { NextResponse } from "next/server";
import RSSParser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

const parser = new RSSParser();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔒 simple shared-secret check
function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!secret || secret !== process.env.INGEST_SECRET) {
    return unauthorized();
  }

  // ✅ DEFINE FEEDS HERE — ONE SOURCE PER FEED
  const feeds = [
    {
      url: "https://www.motocrossactionmag.com/feed/",
      source: "MXA",
      series: "MX",
    },
    {
      url: "https://racerxonline.com/rss",
      source: "RacerX",
      series: "MX",
    },
    {
      url: "https://www.dirtrider.com/feed",
      source: "DirtRider",
      series: "MX",
    },
    {
      url: "https://www.supercrosslive.com/news/feed",
      source: "Supercross",
      series: "SX",
    },
    {
      url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC2F3XnJpQZJ7oE4l5TqJ5xQ",
      source: "MainEventMoto",
      series: "SX",
    },
  ];

  let added = 0;

  for (const feed of feeds) {
    let parsed;

    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      console.error("Failed feed:", feed.url);
      continue;
    }

    for (const item of parsed.items) {
      if (!item.title || !item.link) continue;

      const { error } = await supabase
        .from("posts")
        .upsert(
          {
            title: item.title.trim(),
            url: item.link.trim(),
            source: feed.source,
            series: feed.series,
          },
          { onConflict: "url" }
        );

      if (!error) added++;
    }
  }

  return NextResponse.json({ ok: true, added });
}

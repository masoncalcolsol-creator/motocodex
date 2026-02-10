// app/api/ingest/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Parser from "rss-parser";

export const runtime = "nodejs";

const parser = new Parser();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function inferSeries(defaultSeries: string, title: string) {
  const t = title.toLowerCase();

  // explicit overrides first
  if (t.includes("interview")) return "INTERVIEW";
  if (t.includes("podcast")) return "PODCAST";
  if (t.includes("discount") || t.includes("sale") || t.includes("deal")) return "DISCOUNTS";
  if (t.includes("fmx") || t.includes("freestyle")) return "FMX";
  if (t.includes("smx next") || t.includes("smxnext")) return "SMXNEXT";

  // fallback to feed default
  return defaultSeries || "NEWS";
}

export async function GET() {
  // load active feeds
  const { data: feeds, error: feedErr } = await supabase
    .from("feeds")
    .select("id,source,feed_url,default_series")
    .eq("active", true);

  if (feedErr) {
    return NextResponse.json({ error: feedErr.message }, { status: 500 });
  }

  let inserted = 0;

  for (const feed of feeds || []) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.feed_url);
    } catch (err) {
      console.error("Feed parse failed:", feed.feed_url);
      continue;
    }

    for (const item of parsed.items || []) {
      const title = item.title?.trim();
      const url = item.link?.trim();

      if (!title || !url) continue;

      const series = inferSeries(feed.default_series, title);

      const { error } = await supabase.from("posts").upsert(
        {
          title,
          url,
          source: feed.source,
          series,
        },
        {
          onConflict: "url",
          ignoreDuplicates: true,
        }
      );

      if (!error) inserted++;
    }
  }

  return NextResponse.json({
    status: "ok",
    inserted,
  });
}

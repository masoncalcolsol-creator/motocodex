import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const FEEDS = [
  { name: "Racer X News", series: "SX", url: "https://racerxonline.com/rss" },
  { name: "Vital MX", series: "MX", url: "https://www.vitalmx.com/rss.xml" },
  { name: "MXA", series: "MX", url: "https://motocrossactionmag.com/feed/" },
];

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.INGEST_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parser = new Parser();
  const supabase = adminSb();

  let added = 0;

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of (parsed.items || []).slice(0, 10)) {
        const title = item.title?.trim();
        const link = item.link?.trim();
        if (!title || !link) continue;

        const { error } = await supabase
          .from("posts")
          .upsert(
            {
              title,
              url: link,
              source: feed.name,
              series: feed.series,
            },
            { onConflict: "url" }
          );

        if (!error) added++;
      }
    } catch (e: any) {
      console.log("Feed failed:", feed.url, e?.message || e);
    }
  }

  return Response.json({ ok: true, added });
}

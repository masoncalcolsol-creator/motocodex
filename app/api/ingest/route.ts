import { NextRequest } from "next/server";
import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Feed = { url: string; source: string; series: string };

const FEEDS: Feed[] = [
  { url: "https://rss.app/feeds/aSS1zuuI3ctrFdsO.xml", source: "VitalMX", series: "News" },
  { url: "https://rss.app/feeds/F4ihXBNPFhfG6Zqb.xml", source: "PulpMx", series: "News" },
  { url: "https://rss.app/feeds/kKaJyhdwFRIYQjOK.xml", source: "Main Event Moto", series: "News" },
  { url: "https://rss.app/feeds/O4p5qISqikryCpmo.xml", source: "SwapMotoLive", series: "News" },
  { url: "https://rss.app/feeds/dwr8Fti0aB3SJzbV.xml", source: "Whiskey Throttle", series: "News" },
  { url: "https://rss.app/feeds/hY7dvA2OZ92UPEon.xml", source: "Racer X Online", series: "News" },
  { url: "https://rss.app/feeds/oA2COqosh91E0nlM.xml", source: "SuperMotocross", series: "News" },
  { url: "https://rss.app/feeds/Cv5ooBwheLndl145.xml", source: "Cyclenews", series: "News" },
  { url: "https://rss.app/feeds/I8tDAnxQe4mO5KGB.xml", source: "Dirt Bike Magazine", series: "News" },
  { url: "https://rss.app/feeds/x6iDIlysCAgymTHf.xml", source: "SuperCross Live", series: "News" },
  { url: "https://rss.app/feeds/H81BeG5nsc90AHPH.xml", source: "MXGP", series: "News" },
  { url: "https://rss.app/feeds/Dpv6wMEfCNZK7ftf.xml", source: "MXGPTV", series: "News" },
  { url: "https://rss.app/feeds/K1Q4dPeXaIE44PuN.xml", source: "Matt Burkeen", series: "News" },
  { url: "https://rss.app/feeds/Tbsj4CWbvLUjSWmw.xml", source: "LiveMotocross", series: "News" },
];

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function normalizeUrl(u: string) {
  try {
    const url = new URL(u);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) =>
      url.searchParams.delete(k)
    );
    return url.toString();
  } catch {
    return (u || "").trim();
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || "";
  if (secret !== mustEnv("INGEST_SECRET")) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const parser = new Parser({ timeout: 20000 });

  let totalSeen = 0;
  let totalUpserted = 0;

  const perFeed: any[] = [];

  for (const feed of FEEDS) {
    const report: any = { ...feed, seen: 0, upserted: 0 };

    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 25);

      for (const item of items) {
        const title = (item.title || "").toString().trim();
        const link = normalizeUrl(((item.link as string) || (item.guid as string) || "").trim());
        if (!title || !link) continue;

        report.seen++;
        totalSeen++;

        const { error } = await supabase
          .from("posts")
          .upsert({ title, url: link, source: feed.source, series: feed.series }, { onConflict: "url" });

        if (error) {
          // show first few errors so we can fix it immediately
          report.supabaseErrors = report.supabaseErrors || [];
          if (report.supabaseErrors.length < 5) {
            report.supabaseErrors.push(error.message);
          }
        } else {
          report.upserted++;
          totalUpserted++;
        }
      }
    } catch (e: any) {
      report.error = e?.message || String(e);
    }

    perFeed.push(report);
  }

  return Response.json({ ok: true, totals: { totalSeen, totalUpserted }, perFeed });
}

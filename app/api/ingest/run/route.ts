// FILE: C:\MotoCODEX\app\api\ingest\run\route.ts
// Replace the ENTIRE file with this.
//
// Changes:
// - writes published_at (true publish date)
// - stops setting created_at (DB insertion time stays valid)
// - writes tags based on deterministic topic inference (pods become clusters again)
// - thumbnail_url remains optional (won’t break if column missing; insert will ignore if column absent?)
//   NOTE: If your table does NOT have thumbnail_url, remove it from row below or add the column.

import { NextResponse } from "next/server";
import RSSParser from "rss-parser";
import { createClient } from "@supabase/supabase-js";
import { FEEDS } from "../feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Breakdown = {
  key: string;
  name: string;
  tier: number;
  chosen_url: string | null;
  tried_urls: string[];
  fetched: boolean;
  parsedCount: number;
  attempted: number;
  inserted: number;
  dupesOrSkipped: number;
  errors: string[];
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, service, { auth: { persistSession: false } });
}

function requireAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token !== secret) {
    throw new Error("Unauthorized (bad CRON_SECRET).");
  }
}

function baseImportanceForTier(tier: number) {
  if (tier === 1) return 9.0;
  if (tier === 2) return 6.0;
  return 3.0;
}

function pickUrl(item: any): string | null {
  return (
    (typeof item?.link === "string" && item.link) ||
    (typeof item?.guid === "string" && item.guid) ||
    null
  );
}

function pickTitle(item: any): string | null {
  return (typeof item?.title === "string" && item.title.trim()) ? item.title.trim() : null;
}

function safeIsoDate(raw: any): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickPublishedAt(item: any): string | null {
  // rss-parser commonly gives isoDate; otherwise pubDate
  return (
    safeIsoDate(item?.isoDate) ||
    safeIsoDate(item?.pubDate) ||
    safeIsoDate(item?.published) ||
    safeIsoDate(item?.date) ||
    null
  );
}

function pickThumbnail(item: any): string | null {
  try {
    const mt = item?.["media:thumbnail"];
    if (mt && typeof mt?.url === "string" && mt.url) return mt.url;
    if (Array.isArray(mt) && mt[0]?.url) return mt[0].url;

    const mg = item?.["media:group"] || item?.media?.group;
    const thumb = mg?.["media:thumbnail"] || mg?.thumbnail;
    if (thumb && typeof thumb?.url === "string" && thumb.url) return thumb.url;
    if (Array.isArray(thumb) && thumb[0]?.url) return thumb[0].url;

    const enc = item?.enclosure;
    if (enc && typeof enc?.url === "string" && enc.url) return enc.url;

    return null;
  } catch {
    return null;
  }
}

// ---- Topic inference (deterministic, fast, expandable)
function norm(s: string) {
  return s.toLowerCase();
}

const RIDER_TAGS: Array<{ tag: string; re: RegExp }> = [
  { tag: "webb", re: /\bcooper\s+webb\b|\bwebb\b/i },
  { tag: "sexton", re: /\bchase\s+sexton\b|\bsexton\b/i },
  { tag: "tomac", re: /\bel(i|l)?\s+tomac\b|\btomac\b/i },
  { tag: "jett", re: /\bjett\s+lawrence\b|\bjett\b/i },
  { tag: "hunter", re: /\bhunter\s+lawrence\b/i },
  { tag: "roczen", re: /\bken\s+roczen\b|\broczen\b/i },
  { tag: "anderson", re: /\bjason\s+anderson\b|\banderson\b/i },
  { tag: "stewart", re: /\bmalcolm\s+stewart\b|\bstewart\b/i },
  { tag: "plinger", re: /\bpl(i|l)nger\b/i },
  { tag: "hampshire", re: /\brj\s+hampshire\b|\bhampshire\b/i },
  { tag: "deegan", re: /\bhaiden\s+deegan\b|\bdeegan\b/i },
];

const TEAM_TAGS: Array<{ tag: string; re: RegExp }> = [
  { tag: "honda", re: /\bhonda\b|\bcrf\b/i },
  { tag: "yamaha", re: /\byamaha\b|\byzf\b/i },
  { tag: "kawasaki", re: /\bkawasaki\b|\bkx\b/i },
  { tag: "ktm", re: /\bktm\b/i },
  { tag: "husqvarna", re: /\bhusqvarna\b|\bhusky\b/i },
  { tag: "gasgas", re: /\bgasgas\b/i },
  { tag: "clubmx", re: /\bclub\s*mx\b|\bclubmx\b/i },
  { tag: "star", re: /\bstar\s+racing\b|\bmonster\s+energy\s+star\b/i },
];

const TOPIC_TAGS: Array<{ tag: string; re: RegExp }> = [
  { tag: "injuries", re: /\binjur(y|ies)\b|\bout\b|\bwill miss\b|\bfractur(e|ed)\b|\bbroken\b|\bacl\b|\bconcussion\b/i },
  { tag: "breaking", re: /\bbreaking\b|\bconfirmed\b|\bofficial\b|\bannounced\b/i },
  { tag: "sillyseason", re: /\bsigned\b|\bdeal\b|\bcontract\b|\bjoins\b|\bteam\b|\btransfer\b/i },
  { tag: "results", re: /\bresults\b|\bqualifying\b|\bmain event\b|\bheats?\b|\blap times?\b/i },
  { tag: "pressday", re: /\bpress day\b|\bmedia day\b/i },
  { tag: "bike-tech", re: /\bsetup\b|\bsuspension\b|\bfork\b|\bshock\b|\bengine\b|\bprototype\b|\btest\b/i },
];

function inferTags(title: string): string[] {
  const t = norm(title);
  const out = new Set<string>();

  for (const x of RIDER_TAGS) if (x.re.test(t)) out.add(x.tag);
  for (const x of TEAM_TAGS) if (x.re.test(t)) out.add(x.tag);
  for (const x of TOPIC_TAGS) if (x.re.test(t)) out.add(x.tag);

  // If we have "injuries" we also treat it as "breaking" when very fresh wording appears
  if (out.has("injuries") && /\bout\b|\bmiss\b|\bwill miss\b|\bconfirmed\b/i.test(t)) out.add("breaking");

  return Array.from(out);
}

async function parseFirstWorkingFeed(
  parser: RSSParser<any>,
  urls: string[],
  breakdown: Breakdown
): Promise<{ chosenUrl: string | null; items: any[] }> {
  for (const url of urls) {
    breakdown.tried_urls.push(url);

    if (url.includes("REPLACE_ME_") || url.includes("REPLACE_CHANNEL_ID_")) {
      breakdown.errors.push(`Feed URL is placeholder: ${url}`);
      continue;
    }

    try {
      const parsed = await parser.parseURL(url);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      if (items.length === 0) {
        breakdown.errors.push(`Parsed 0 items from: ${url}`);
        continue;
      }

      return { chosenUrl: url, items };
    } catch (e: any) {
      breakdown.errors.push(`Parse failed for ${url}: ${e?.message ? String(e.message) : "unknown"}`);
      continue;
    }
  }

  return { chosenUrl: null, items: [] };
}

export async function GET(req: Request) {
  try {
    requireAuth(req);

    const supabase = supabaseAdmin();
    const parser = new RSSParser({
      timeout: 20000,
      headers: {
        "User-Agent": "MotoCODEX/2.0 (+vercel)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    const breakdown: Breakdown[] = [];

    for (const feed of FEEDS) {
      const b: Breakdown = {
        key: feed.key,
        name: feed.name,
        tier: feed.tier,
        chosen_url: null,
        tried_urls: [],
        fetched: false,
        parsedCount: 0,
        attempted: 0,
        inserted: 0,
        dupesOrSkipped: 0,
        errors: [],
      };

      const { chosenUrl, items } = await parseFirstWorkingFeed(parser, feed.urls, b);

      if (!chosenUrl || items.length === 0) {
        breakdown.push(b);
        continue;
      }

      b.chosen_url = chosenUrl;
      b.fetched = true;
      b.parsedCount = items.length;

      const slice = items.slice(0, 40);

      for (const it of slice) {
        const url = pickUrl(it);
        const title = pickTitle(it);
        if (!url || !title) {
          b.dupesOrSkipped += 1;
          continue;
        }

        b.attempted += 1;

        const published_at = pickPublishedAt(it);
        const tags = inferTags(title);
        const thumb = pickThumbnail(it);

        const row: any = {
          source_key: feed.key,
          source_name: feed.name,
          title,
          url,
          importance: baseImportanceForTier(feed.tier),
          published_at: published_at ?? null,
          tags: tags.length ? tags : null,
          // If your DB does NOT have thumbnail_url yet, remove the next line OR add the column.
          thumbnail_url: thumb ?? null,
        };

        const { error } = await supabase.from("news_items").insert(row);

        if (error) {
          const msg = error.message || "insert error";
          const isDupe =
            msg.toLowerCase().includes("duplicate") ||
            msg.toLowerCase().includes("unique") ||
            msg.toLowerCase().includes("violates");

          if (isDupe) b.dupesOrSkipped += 1;
          else b.errors.push(msg);
        } else {
          b.inserted += 1;
        }
      }

      breakdown.push(b);
    }

    const totals = breakdown.reduce(
      (acc, b) => {
        acc.feeds += 1;
        acc.attempted += b.attempted;
        acc.inserted += b.inserted;
        acc.skipped += b.dupesOrSkipped;
        acc.feedErrors += b.errors.length ? 1 : 0;
        return acc;
      },
      { feeds: 0, attempted: 0, inserted: 0, skipped: 0, feedErrors: 0 }
    );

    return NextResponse.json({ ok: true, totals, breakdown });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ? String(e.message) : "Unknown error" },
      { status: 500 }
    );
  }
}
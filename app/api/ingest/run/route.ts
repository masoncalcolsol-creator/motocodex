// FILE: C:\MotoCODEX\app\api\ingest\run\route.ts
// Replace the ENTIRE file with this.
//
// Adds:
// - thumbnail_url extraction (YouTube + generic RSS where present)
// - writes news_items.thumbnail_url
// - per-feed chosen_url reporting
//
// IMPORTANT:
// - You MUST have applied the DB migration adding thumbnail_url first.

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

function safeIsoDate(item: any): string | null {
  const raw =
    item?.isoDate ||
    item?.pubDate ||
    item?.published ||
    item?.date ||
    null;

  if (!raw) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickThumbnail(item: any): string | null {
  // YouTube RSS commonly exposes:
  // - media:group -> media:thumbnail
  // rss-parser often maps media:thumbnail as item["media:thumbnail"] or item.media?.thumbnail
  try {
    // 1) rss-parser common shape
    const mt = item?.["media:thumbnail"];
    if (mt && typeof mt?.url === "string" && mt.url) return mt.url;
    if (Array.isArray(mt) && mt[0]?.url) return mt[0].url;

    // 2) media:group (sometimes)
    const mg = item?.["media:group"] || item?.media?.group;
    const thumb = mg?.["media:thumbnail"] || mg?.thumbnail;
    if (thumb && typeof thumb?.url === "string" && thumb.url) return thumb.url;
    if (Array.isArray(thumb) && thumb[0]?.url) return thumb[0].url;

    // 3) enclosure (podcasts etc)
    const enc = item?.enclosure;
    if (enc && typeof enc?.url === "string" && enc.url) return enc.url;

    return null;
  } catch {
    return null;
  }
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

      // Limit per feed to prevent one source dominating
      const slice = items.slice(0, 40);

      for (const it of slice) {
        const url = pickUrl(it);
        const title = pickTitle(it);
        if (!url || !title) {
          b.dupesOrSkipped += 1;
          continue;
        }

        b.attempted += 1;

        const thumb = pickThumbnail(it);

        const row: any = {
          source_key: feed.key,
          source_name: feed.name,
          title,
          url,
          tags: null,
          importance: baseImportanceForTier(feed.tier),
          thumbnail_url: thumb ?? null,
          created_at: safeIsoDate(it) ?? undefined,
        };

        const { error } = await supabase.from("news_items").insert(row);

        if (error) {
          const msg = error.message || "insert error";
          const isDupe =
            msg.toLowerCase().includes("duplicate") ||
            msg.toLowerCase().includes("unique") ||
            msg.toLowerCase().includes("violates");

          if (isDupe) {
            b.dupesOrSkipped += 1;
          } else {
            b.errors.push(msg);
          }
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
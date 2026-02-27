// FILE: C:\MotoCODEX\app\api\feeds\youtube\run\route.ts
// Create this NEW file.
//
// Pulls enabled social_sources where platform='youtube'
// Fetches YouTube RSS for each channel_id
// Inserts into social_posts with dedupe_key = 'youtube:<videoId>'
//
// Env:
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - CRON_SECRET (optional)

import { NextResponse } from "next/server";
import RSSParser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Breakdown = {
  source_id: string;
  handle: string | null;
  channel_id: string | null;
  fetched: boolean;
  parsed: number;
  inserted: number;
  dupes: number;
  errors: string[];
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, service, { auth: { persistSession: false } });
}

function requireAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token !== secret) throw new Error("Unauthorized (bad CRON_SECRET).");
}

function safeIsoDate(raw: any): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickYouTubeThumb(item: any): string | null {
  try {
    const mt = item?.["media:thumbnail"];
    if (mt && typeof mt?.url === "string" && mt.url) return mt.url;
    if (Array.isArray(mt) && mt[0]?.url) return mt[0].url;

    const mg = item?.["media:group"] || item?.media?.group;
    const thumb = mg?.["media:thumbnail"] || mg?.thumbnail;
    if (thumb && typeof thumb?.url === "string" && thumb.url) return thumb.url;
    if (Array.isArray(thumb) && thumb[0]?.url) return thumb[0].url;

    return null;
  } catch {
    return null;
  }
}

function extractVideoId(item: any): string | null {
  // YouTube RSS tends to provide:
  // - id like "yt:video:VIDEOID"
  // - link like https://www.youtube.com/watch?v=VIDEOID
  const rawId = (item?.id ?? "") as string;
  const m = rawId.match(/yt:video:([a-zA-Z0-9_\-]+)/);
  if (m?.[1]) return m[1];

  const link = (item?.link ?? "") as string;
  const m2 = link.match(/[?&]v=([a-zA-Z0-9_\-]+)/);
  if (m2?.[1]) return m2[1];

  return null;
}

export async function GET(req: Request) {
  try {
    requireAuth(req);
    const supabase = supabaseAdmin();

    const { data: sources, error: srcErr } = await supabase
      .from("social_sources")
      .select("id,handle,channel_id,title,tier,is_enabled")
      .eq("platform", "youtube")
      .eq("is_enabled", true);

    if (srcErr) throw new Error(`social_sources query failed: ${srcErr.message}`);

    const parser = new RSSParser({
      timeout: 20000,
      headers: {
        "User-Agent": "MotoFEEDS/1.0 (+vercel)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    const breakdown: Breakdown[] = [];
    let totalInserted = 0;

    for (const s of (sources ?? []) as any[]) {
      const b: Breakdown = {
        source_id: s.id,
        handle: s.handle ?? null,
        channel_id: s.channel_id ?? null,
        fetched: false,
        parsed: 0,
        inserted: 0,
        dupes: 0,
        errors: [],
      };

      const channelId = (s.channel_id ?? "").trim();
      if (!channelId || channelId.includes("REPLACE_")) {
        b.errors.push("Missing/placeholder channel_id");
        breakdown.push(b);
        continue;
      }

      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

      try {
        const parsed = await parser.parseURL(feedUrl);
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        b.fetched = true;
        b.parsed = items.length;

        for (const it of items.slice(0, 30)) {
          const videoId = extractVideoId(it);
          const url = (it?.link ?? "") as string;
          const title = (it?.title ?? "") as string;

          if (!videoId || !url) {
            b.dupes += 1;
            continue;
          }

          const row: any = {
            platform: "youtube",
            source_id: s.id,
            source_handle: s.handle ?? null,
            source_title: s.title ?? null,
            post_id: videoId,
            url,
            title: title || null,
            text: (it?.contentSnippet ?? it?.content ?? null) ?? null,
            thumbnail_url: pickYouTubeThumb(it),
            published_at: safeIsoDate(it?.isoDate ?? it?.pubDate) ?? null,
            tags: null,
            dedupe_key: `youtube:${videoId}`,
          };

          const { error: insErr } = await supabase.from("social_posts").insert(row);

          if (insErr) {
            const msg = insErr.message || "insert error";
            const isDupe =
              msg.toLowerCase().includes("duplicate") ||
              msg.toLowerCase().includes("unique") ||
              msg.toLowerCase().includes("violates");
            if (isDupe) b.dupes += 1;
            else b.errors.push(msg);
          } else {
            b.inserted += 1;
            totalInserted += 1;
          }
        }
      } catch (e: any) {
        b.errors.push(e?.message ? String(e.message) : "parse failed");
      }

      breakdown.push(b);
    }

    return NextResponse.json({
      ok: true,
      sources: (sources ?? []).length,
      inserted: totalInserted,
      breakdown,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ? String(e.message) : "Unknown error" }, { status: 500 });
  }
}
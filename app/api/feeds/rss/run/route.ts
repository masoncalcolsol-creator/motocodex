// FILE: C:\MotoCODEX\app\api\feeds\rss\run\route.ts
// Replace the ENTIRE file with this.

import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { assertCronSecretOrThrow } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeText(s: string | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m?.[1]) return null;
  return decodeBasicEntities(m[1]).trim();
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*\\/?>`, "i"));
  return m?.[1]?.trim() ?? null;
}

function extractFirstImg(html: string): string | null {
  const m = html.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
  return m?.[1]?.trim() ?? null;
}

function sha1(s: string) {
  return createHash("sha1").update(s).digest("hex");
}

type FeedItem = {
  title: string;
  url: string;
  published_at: string;
  thumbnail_url?: string | null;
  raw?: any;
};

function parseRssOrAtom(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  const rssItems = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssItems) {
    const title = safeText(extractTag(block, "title")) || "Untitled";
    const link = safeText(extractTag(block, "link")) || safeText(extractTag(block, "guid"));
    if (!link) continue;

    const pub =
      safeText(extractTag(block, "pubDate")) ||
      safeText(extractTag(block, "dc:date")) ||
      safeText(extractTag(block, "published")) ||
      safeText(extractTag(block, "updated"));

    const published_at = pub ? new Date(pub).toISOString() : null;
    if (!published_at) continue;

    const mediaThumb = extractAttr(block, "media:thumbnail", "url");
    const enclosure = extractAttr(block, "enclosure", "url");
    const contentEncoded = extractTag(block, "content:encoded");
    const htmlThumb = contentEncoded ? extractFirstImg(contentEncoded) : null;

    items.push({
      title,
      url: link,
      published_at,
      thumbnail_url: mediaThumb || enclosure || htmlThumb || null,
      raw: { kind: "rss" },
    });
  }

  const atomEntries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomEntries) {
    const title = safeText(extractTag(block, "title")) || "Untitled";

    const atomLink =
      (block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/?>/i)?.[1] ?? null)?.trim() ||
      (block.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i)?.[1] ?? null)?.trim() ||
      null;

    if (!atomLink) continue;

    const pub =
      safeText(extractTag(block, "published")) ||
      safeText(extractTag(block, "updated")) ||
      safeText(extractTag(block, "dc:date"));

    const published_at = pub ? new Date(pub).toISOString() : null;
    if (!published_at) continue;

    const mediaThumb = extractAttr(block, "media:thumbnail", "url");
    const enclosure = extractAttr(block, "enclosure", "url");
    const summary = extractTag(block, "summary");
    const content = extractTag(block, "content");
    const htmlThumb = extractFirstImg(summary || content || "");

    items.push({
      title,
      url: atomLink,
      published_at,
      thumbnail_url: mediaThumb || enclosure || htmlThumb || null,
      raw: { kind: "atom" },
    });
  }

  // Dedup by URL (newest wins)
  const seen = new Map<string, FeedItem>();
  for (const it of items) {
    const prev = seen.get(it.url);
    if (!prev) seen.set(it.url, it);
    else if (new Date(it.published_at).getTime() > new Date(prev.published_at).getTime()) seen.set(it.url, it);
  }

  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

async function countExistingByKeys(supabase: any, keys: string[]) {
  if (!keys.length) return 0;

  // PostgREST "in" list can be touchy; keep it safe
  const chunkSize = 50;
  let total = 0;

  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("social_posts")
      .select("dedupe_key")
      .in("dedupe_key", chunk);

    if (error) throw new Error(error.message);
    total += (data ?? []).length;
  }

  return total;
}

async function ingestOneSource(source: any) {
  const supabase = supabaseServer();
  const startedAt = new Date().toISOString();

  const { data: runRow } = await supabase
    .from("feed_ingest_runs")
    .insert({
      platform: source.platform,
      source_id: source.id,
      started_at: startedAt,
      ok: false,
      fetched_count: 0,
      inserted_count: 0,
    })
    .select("id")
    .single();

  const runId = runRow?.id ?? null;

  try {
    const feedUrl: string | null = (source.feed_url ?? null) as string | null;
    if (!feedUrl) throw new Error("No feed_url. For Instagram RSS sources, feed_url is required.");

    const r = await fetch(feedUrl, {
      method: "GET",
      headers: {
        "user-agent": "MotoFEEDS/1.0 (+MotoCODEX)",
        accept: "application/rss+xml,application/xml,text/xml,*/*",
      },
      cache: "no-store",
    });

    const body = await r.text().catch(() => "");
    if (!r.ok) {
      throw new Error(`Fetch failed ${r.status}: ${r.statusText} :: ${safeText(body).slice(0, 240)}`);
    }

    const items = parseRssOrAtom(body);
    const fetchedCount = items.length;

    const rows = items.map((it) => {
      const url = it.url;
      const platform = String(source.platform || "instagram");
      const dedupe_key = `${platform}:${sha1(url)}`;

      return {
        platform,
        source_id: source.id,
        dedupe_key,
        title: it.title,
        url,
        thumbnail_url: it.thumbnail_url ?? null,
        published_at: it.published_at,
        raw: {
          feed_url: feedUrl,
          parsed: it.raw ?? null,
        },
      };
    });

    const keys = rows.map((x) => x.dedupe_key);

    // Count before
    const beforeCount = await countExistingByKeys(supabase, keys);

    // Upsert (ignore duplicates)
    const { error: upErr } = await supabase
      .from("social_posts")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });

    if (upErr) throw new Error(upErr.message);

    // Count after
    const afterCount = await countExistingByKeys(supabase, keys);

    const insertedCount = Math.max(0, afterCount - beforeCount);

    const finishedAt = new Date().toISOString();

    await supabase
      .from("feed_ingest_runs")
      .update({
        finished_at: finishedAt,
        fetched_count: fetchedCount,
        inserted_count: insertedCount,
        ok: true,
        error_text: null,
        details: { feed_url: feedUrl, platform: source.platform, beforeCount, afterCount, attempted: rows.length },
      })
      .eq("id", runId);

    await supabase
      .from("social_sources")
      .update({
        last_ingested_at: finishedAt,
        last_ingest_status: "ok",
        last_error: null,
      })
      .eq("id", source.id);

    return {
      source_id: source.id,
      title: source.title ?? source.handle ?? "Unknown",
      fetched: fetchedCount,
      inserted: insertedCount,
      ok: true,
    };
  } catch (err: any) {
    const finishedAt = new Date().toISOString();
    const msg = safeText(err?.message ?? String(err));

    if (runId) {
      await supabase
        .from("feed_ingest_runs")
        .update({
          finished_at: finishedAt,
          ok: false,
          error_text: msg,
        })
        .eq("id", runId);
    }

    await supabase
      .from("social_sources")
      .update({
        last_ingested_at: finishedAt,
        last_ingest_status: "error",
        last_error: msg,
      })
      .eq("id", source.id);

    return {
      source_id: source.id,
      title: source.title ?? source.handle ?? "Unknown",
      fetched: 0,
      inserted: 0,
      ok: false,
      error: msg,
    };
  }
}

export async function GET(request: Request) {
  try {
    assertCronSecretOrThrow(request);

    const supabase = supabaseServer();

    const { data: sources, error } = await supabase
      .from("social_sources")
      .select("*")
      .in("platform", ["instagram"])
      .eq("enabled", true)
      .order("tier", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const list = sources ?? [];

    const results: any[] = [];
    let totalFetched = 0;
    let totalInserted = 0;
    let okCount = 0;

    for (const s of list) {
      const res = await ingestOneSource(s);
      results.push(res);
      totalFetched += res.fetched || 0;
      totalInserted += res.inserted || 0;
      if (res.ok) okCount += 1;
    }

    return Response.json({
      ok: true,
      sources: list.length,
      okCount,
      totalFetched,
      totalInserted,
      results,
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
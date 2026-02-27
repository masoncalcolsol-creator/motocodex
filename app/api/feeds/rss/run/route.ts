// FILE: C:\MotoCODEX\app\api\feeds\rss\run\route.ts
// Create this file.

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

function extractFirstUrlFromHtml(html: string): string | null {
  // naive but effective: grab first <img src="...">
  const m = html.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
  return m?.[1]?.trim() ?? null;
}

type FeedItem = {
  title: string;
  url: string;
  published_at: string;
  thumbnail_url?: string | null;
  raw?: any;
};

/**
 * Parse RSS 2.0 (<item>) and Atom (<entry>).
 * We only need: title, link, published date, thumbnail.
 */
function parseRssOrAtom(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  // RSS 2.0 items
  const rssItems = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssItems) {
    const title = safeText(extractTag(block, "title")) || "Untitled";

    // <link> is common; sometimes <guid> contains URL
    const link = safeText(extractTag(block, "link")) || safeText(extractTag(block, "guid"));
    if (!link) continue;

    const pub =
      safeText(extractTag(block, "pubDate")) ||
      safeText(extractTag(block, "dc:date")) ||
      safeText(extractTag(block, "published")) ||
      safeText(extractTag(block, "updated"));

    const published_at = pub ? new Date(pub).toISOString() : null;
    if (!published_at) continue;

    // Thumbnail candidates:
    // - media:thumbnail url=""
    // - enclosure url=""
    // - content:encoded (first img)
    const mediaThumb = extractAttr(block, "media:thumbnail", "url");
    const enclosure = extractAttr(block, "enclosure", "url");
    const contentEncoded = extractTag(block, "content:encoded");
    const htmlThumb = contentEncoded ? extractFirstUrlFromHtml(contentEncoded) : null;

    const thumbnail_url = mediaThumb || enclosure || htmlThumb || null;

    items.push({
      title,
      url: link,
      published_at,
      thumbnail_url,
      raw: { kind: "rss" },
    });
  }

  // Atom entries
  const atomEntries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomEntries) {
    const title = safeText(extractTag(block, "title")) || "Untitled";

    // Atom link: <link rel="alternate" href="..."/>
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
    const htmlThumb = extractFirstUrlFromHtml(summary || content || "");

    const thumbnail_url = mediaThumb || enclosure || htmlThumb || null;

    items.push({
      title,
      url: atomLink,
      published_at,
      thumbnail_url,
      raw: { kind: "atom" },
    });
  }

  // Deduplicate by url (keep newest)
  const seen = new Map<string, FeedItem>();
  for (const it of items) {
    const prev = seen.get(it.url);
    if (!prev) {
      seen.set(it.url, it);
    } else {
      if (new Date(it.published_at).getTime() > new Date(prev.published_at).getTime()) {
        seen.set(it.url, it);
      }
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
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
      const dedupe_key = `${source.platform}:${it.url}`; // stable dedupe
      return {
        platform: source.platform,
        source_id: source.id,
        dedupe_key,
        title: it.title,
        url: it.url,
        thumbnail_url: it.thumbnail_url ?? null,
        published_at: it.published_at,
        raw: {
          feed_url: feedUrl,
          parsed: it.raw ?? null,
        },
      };
    });

    let insertedCount = 0;

    if (rows.length) {
      const { data, error } = await supabase
        .from("social_posts")
        .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id");

      if (error) throw new Error(error.message);
      insertedCount = (data ?? []).length;
    }

    const finishedAt = new Date().toISOString();

    await supabase
      .from("feed_ingest_runs")
      .update({
        finished_at: finishedAt,
        fetched_count: fetchedCount,
        inserted_count: insertedCount,
        ok: true,
        error_text: null,
        details: { feed_url: feedUrl, platform: source.platform },
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

    // v1: ingest RSS-based platforms (instagram now; more later)
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
    const status = err?.status ?? 500;
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status });
  }
}
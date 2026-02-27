// FILE: C:\MotoCODEX\app\api\feeds\youtube\run\route.ts
// Replace the ENTIRE file with this.

import { supabaseServer } from "@/lib/supabaseServer";
import { assertCronSecretOrThrow } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type YtEntry = {
  videoId: string | null;
  title: string | null;
  published: string | null;
  link: string | null;
  thumbnailUrl: string | null;
};

function safeText(s: string | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function parseYouTubeAtom(xml: string): YtEntry[] {
  const entries: YtEntry[] = [];
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/g) ?? [];

  for (const block of entryBlocks) {
    const videoId =
      (block.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)?.[1] ?? null)?.trim() || null;

    const title =
      (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? null)?.trim() || null;

    const published =
      (block.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? null)?.trim() || null;

    const link =
      (block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/?>/i)?.[1] ?? null)?.trim() ||
      null;

    const thumbnailUrl =
      (block.match(/<media:thumbnail[^>]*url="([^"]+)"[^>]*\/?>/i)?.[1] ?? null)?.trim() ||
      null;

    if (!title && !videoId) continue;
    entries.push({ videoId, title, published, link, thumbnailUrl });
  }

  return entries;
}

async function resolveChannelIdFromHandle(handle: string): Promise<string | null> {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return null;

  const url = `https://www.youtube.com/@${encodeURIComponent(h)}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "MotoFEEDS/1.0 (+MotoCODEX)",
      accept: "text/html,*/*",
    },
    cache: "no-store",
  });

  if (!r.ok) return null;

  const html = await r.text();

  let m = html.match(/"channelId"\s*:\s*"((UC)[a-zA-Z0-9_-]{20,})"/);
  if (m?.[1]) return m[1];

  m = html.match(/https:\/\/www\.youtube\.com\/channel\/((UC)[a-zA-Z0-9_-]{20,})/);
  if (m?.[1]) return m[1];

  m = html.match(/"browseId"\s*:\s*"((UC)[a-zA-Z0-9_-]{20,})"/);
  if (m?.[1]) return m[1];

  return null;
}

function buildFeedUrlFromChannelId(channelId: string) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

async function fetchFeedXml(feedUrl: string): Promise<{ ok: boolean; status: number; statusText: string; body: string }> {
  const r = await fetch(feedUrl, {
    method: "GET",
    headers: {
      "user-agent": "MotoFEEDS/1.0 (+MotoCODEX)",
      accept: "application/atom+xml,application/xml,text/xml,*/*",
    },
    cache: "no-store",
  });

  const body = await r.text().catch(() => "");
  return { ok: r.ok, status: r.status, statusText: r.statusText, body };
}

async function ingestOneSource(source: any) {
  const supabase = supabaseServer();

  const startedAt = new Date().toISOString();

  const { data: runRow } = await supabase
    .from("feed_ingest_runs")
    .insert({
      platform: "youtube",
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
    let channelId: string | null = (source.channel_id ?? null) as string | null;
    const handle: string | null = (source.handle ?? null) as string | null;

    let feedUrl: string | null = (source.feed_url ?? null) as string | null;

    if (channelId) feedUrl = buildFeedUrlFromChannelId(channelId);

    if (!channelId && handle) {
      channelId = await resolveChannelIdFromHandle(handle);
      if (channelId) {
        feedUrl = buildFeedUrlFromChannelId(channelId);
        await supabase
          .from("social_sources")
          .update({ channel_id: channelId, feed_url: feedUrl })
          .eq("id", source.id);
      }
    }

    if (!feedUrl) throw new Error("No feed_url. Provide channel_id or handle.");

    let feedResp = await fetchFeedXml(feedUrl);

    if (!feedResp.ok && feedResp.status === 404 && handle) {
      const resolved = await resolveChannelIdFromHandle(handle);
      if (resolved && resolved !== channelId) {
        channelId = resolved;
        feedUrl = buildFeedUrlFromChannelId(channelId);

        await supabase
          .from("social_sources")
          .update({ channel_id: channelId, feed_url: feedUrl })
          .eq("id", source.id);

        feedResp = await fetchFeedXml(feedUrl);
      }
    }

    if (!feedResp.ok) {
      throw new Error(
        `Fetch failed ${feedResp.status}: ${feedResp.statusText} :: ${safeText(feedResp.body).slice(0, 240)}`
      );
    }

    const xml = feedResp.body;
    const entries = parseYouTubeAtom(xml);

    const fetchedCount = entries.length;

    // Build rows for bulk upsert
    const rows = entries
      .map((e) => {
        const videoId = e.videoId;
        const publishedAt = e.published ? new Date(e.published).toISOString() : null;
        const url = e.link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
        if (!url || !publishedAt) return null;

        const dedupeKey = `youtube:${videoId || url}`;

        return {
          platform: "youtube",
          source_id: source.id,
          dedupe_key: dedupeKey,
          title: safeText(e.title) || "Untitled",
          url,
          thumbnail_url: e.thumbnailUrl,
          published_at: publishedAt,
          video_id: videoId,
          channel_id: channelId,
          raw: { feed_url: feedUrl },
        };
      })
      .filter(Boolean) as any[];

    // Bulk upsert, ignore duplicates by dedupe_key
    let insertedCount = 0;
    const errorSamples: any[] = [];

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("social_posts")
        .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id");

      if (error) {
        errorSamples.push({ stage: "upsert", message: error.message, details: (error as any).details });
      } else {
        insertedCount = (data ?? []).length;
      }
    }

    const finishedAt = new Date().toISOString();

    await supabase
      .from("feed_ingest_runs")
      .update({
        finished_at: finishedAt,
        fetched_count: fetchedCount,
        inserted_count: insertedCount,
        ok: errorSamples.length === 0,
        error_text: errorSamples.length ? JSON.stringify(errorSamples).slice(0, 1000) : null,
        details: {
          feed_url: feedUrl,
          channel_id: channelId,
          attempted: rows.length,
          errorSamples,
        },
      })
      .eq("id", runId);

    await supabase
      .from("social_sources")
      .update({
        last_ingested_at: finishedAt,
        last_ingest_status: errorSamples.length ? "error" : "ok",
        last_error: errorSamples.length ? JSON.stringify(errorSamples).slice(0, 1000) : null,
        feed_url: feedUrl,
        channel_id: channelId,
      })
      .eq("id", source.id);

    if (errorSamples.length) {
      return {
        source_id: source.id,
        title: source.title ?? source.handle ?? source.channel_id ?? "Unknown",
        fetched: fetchedCount,
        inserted: insertedCount,
        ok: false,
        error: errorSamples[0]?.message ?? "Insert failed",
      };
    }

    return {
      source_id: source.id,
      title: source.title ?? source.handle ?? source.channel_id ?? "Unknown",
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
      title: source.title ?? source.handle ?? source.channel_id ?? "Unknown",
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
      .eq("platform", "youtube")
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
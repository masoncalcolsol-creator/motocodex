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
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/g) ?? [];

  for (const b of blocks) {
    const videoId =
      (b.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)?.[1] ?? null)?.trim() || null;
    const title = (b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? null)?.trim() || null;
    const published = (b.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? null)?.trim() || null;
    const link =
      (b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/?>/i)?.[1] ?? null)?.trim() ||
      null;
    const thumbnailUrl =
      (b.match(/<media:thumbnail[^>]*url="([^"]+)"[^>]*\/?>/i)?.[1] ?? null)?.trim() ||
      null;

    if (!videoId && !title) continue;
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

function buildFeedUrl(channelId: string) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

async function fetchXml(url: string) {
  const r = await fetch(url, {
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

    // Resolve channel id if missing
    if (!channelId && handle) {
      channelId = await resolveChannelIdFromHandle(handle);
      if (channelId) {
        await supabase.from("social_sources").update({ channel_id: channelId }).eq("id", source.id);
      }
    }

    if (!channelId) throw new Error("No channel_id. Provide channel_id or handle.");

    const feedUrl = buildFeedUrl(channelId);

    // Persist feed_url (handy for debugging)
    await supabase.from("social_sources").update({ feed_url: feedUrl }).eq("id", source.id);

    const resp = await fetchXml(feedUrl);
    if (!resp.ok) {
      throw new Error(`Fetch failed ${resp.status}: ${resp.statusText} :: ${safeText(resp.body).slice(0, 240)}`);
    }

    const entries = parseYouTubeAtom(resp.body);
    const fetchedCount = entries.length;

    const rows = entries
      .map((e) => {
        const videoId = e.videoId;
        const publishedAt = e.published ? new Date(e.published).toISOString() : null;
        const url = e.link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
        if (!videoId || !publishedAt || !url) return null;

        return {
          platform: "youtube",
          source_id: source.id,
          dedupe_key: `youtube:${videoId}`,
          title: safeText(e.title) || "Untitled",
          url,
          thumbnail_url: e.thumbnailUrl ?? null,
          published_at: publishedAt,
          video_id: videoId,
          channel_id: channelId,
          raw: { feed_url: feedUrl },
        };
      })
      .filter(Boolean) as any[];

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
        details: { feed_url: feedUrl, channel_id: channelId, attempted: rows.length },
      })
      .eq("id", runId);

    await supabase
      .from("social_sources")
      .update({
        last_ingested_at: finishedAt,
        last_ingest_status: "ok",
        last_error: null,
        channel_id: channelId,
        feed_url: feedUrl,
      })
      .eq("id", source.id);

    return { source_id: source.id, title: source.title ?? source.handle ?? "Unknown", fetched: fetchedCount, inserted: insertedCount, ok: true };
  } catch (err: any) {
    const finishedAt = new Date().toISOString();
    const msg = safeText(err?.message ?? String(err));

    if (runId) {
      await supabase.from("feed_ingest_runs").update({ finished_at: finishedAt, ok: false, error_text: msg }).eq("id", runId);
    }

    await supabase
      .from("social_sources")
      .update({ last_ingested_at: finishedAt, last_ingest_status: "error", last_error: msg })
      .eq("id", source.id);

    return { source_id: source.id, title: source.title ?? source.handle ?? "Unknown", fetched: 0, inserted: 0, ok: false, error: msg };
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

    return Response.json({ ok: true, sources: list.length, okCount, totalFetched, totalInserted, results });
  } catch (err: any) {
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
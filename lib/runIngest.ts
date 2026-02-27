// FILE: lib/runIngest.ts
// Replace the ENTIRE file with this.

import crypto from "crypto";
import Parser from "rss-parser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IngestError = { feedUrl: string; message: string };

export type RunIngestResult = {
  inserted: number;   // best-effort (may be 0 even when updates happened)
  upserted: number;   // rows written/updated (the "activity" metric you actually want)
  attempted: number;
  fetched: number;
  feedCount: number;
  errors: IngestError[];
};

type NormalizedRow = {
  dedupe_hash: string;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  summary: string | null;
  raw: any;
};

function safeString(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (typeof v === "object") {
    const candidates = [
      (v as any)["_"],
      (v as any)["#text"],
      (v as any)["value"],
      (v as any)["text"],
      (v as any)["title"],
      (v as any)["name"],
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c;
    }
    try {
      const j = JSON.stringify(v);
      return typeof j === "string" ? j : "";
    } catch {
      return "";
    }
  }

  return "";
}

function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sha1(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function getHost(u: string): string | null {
  try {
    return new URL(u).host || null;
  } catch {
    return null;
  }
}

function toIsoOrNull(d: any): string | null {
  const s = safeString(d).trim();
  if (!s) return null;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function pickItemUrl(item: any): string {
  const link = safeString(item?.link).trim();
  if (link) return link;

  const guid = safeString(item?.guid).trim();
  if (guid && (guid.startsWith("http://") || guid.startsWith("https://"))) return guid;

  const id = safeString(item?.id).trim();
  if (id && (id.startsWith("http://") || id.startsWith("https://"))) return id;

  return "";
}

export async function runIngest(): Promise<RunIngestResult> {
  const feedsRaw = (process.env.MOTOCODEX_RSS_FEEDS || "").trim();
  if (!feedsRaw) {
    return {
      inserted: 0,
      upserted: 0,
      attempted: 0,
      fetched: 0,
      feedCount: 0,
      errors: [{ feedUrl: "(env)", message: "Missing MOTOCODEX_RSS_FEEDS" }],
    };
  }

  const feedUrls = feedsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const parser = new Parser({
    timeout: 20000,
    headers: {
      "User-Agent": "MotoCODEX/1.0 (+rss ingest)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    customFields: {
      item: ["content:encoded", "media:content", "media:thumbnail"],
    },
  });

  let inserted = 0;  // best-effort
  let upserted = 0;  // strong activity metric
  let attempted = 0;
  let fetched = 0;
  const errors: IngestError[] = [];

  for (const feedUrl of feedUrls) {
    try {
      const res = await fetch(feedUrl, {
        method: "GET",
        headers: {
          "User-Agent": "MotoCODEX/1.0 (+rss ingest)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        errors.push({ feedUrl, message: `Status code ${res.status}` });
        continue;
      }

      const xml = await res.text();

      let feed: any;
      try {
        feed = await parser.parseString(xml);
      } catch (e: any) {
        errors.push({ feedUrl, message: e?.message || "RSS parse error" });
        continue;
      }

      const feedTitle = safeString(feed?.title).trim();
      const source =
        feedTitle ||
        getHost(feedUrl) ||
        safeString(feed?.link).trim() ||
        null;

      const items: any[] = Array.isArray(feed?.items) ? feed.items : [];
      fetched += items.length;

      const rows: NormalizedRow[] = [];

      for (const it of items) {
        const title = safeString(it?.title).trim();
        const url = pickItemUrl(it);

        if (!url) continue;

        const titleFinal = title || url;
        if (!titleFinal) continue;

        const published_at =
          toIsoOrNull(it?.isoDate) ||
          toIsoOrNull(it?.pubDate) ||
          toIsoOrNull(it?.published) ||
          null;

        const summary =
          safeString(it?.contentSnippet).trim() ||
          safeString(it?.summary).trim() ||
          safeString(it?.content).trim() ||
          safeString((it as any)?.["content:encoded"]).trim() ||
          null;

        // Keep dedupe_hash around for clustering/debug, but NOT as the write key anymore.
        const key = normalizeText(`${titleFinal} ${url}`);
        const dedupe_hash = sha1(key);

        rows.push({
          dedupe_hash,
          title: titleFinal,
          url,
          source,
          published_at,
          summary,
          raw: {
            feedUrl,
            feedTitle: feedTitle || null,
            feedLink: safeString(feed?.link).trim() || null,
            item: it,
          },
        });
      }

      if (rows.length === 0) continue;

      attempted += rows.length;

      // UPSERT on URL so existing stories refresh instead of being ignored
      const { error } = await supabaseAdmin
        .from("news_items")
        .upsert(rows as any, {
          onConflict: "url",
        });

      if (error) {
        errors.push({ feedUrl, message: `Supabase upsert error: ${error.message}` });
        continue;
      }

      // With UPSERT, inserts vs updates aren't reliably reported without extra round-trips.
      // Track activity as "upserted rows" so you can tell the pipeline is alive.
      upserted += rows.length;
    } catch (e: any) {
      errors.push({ feedUrl, message: e?.message || "Unknown ingest error" });
      continue;
    }
  }

  return {
    inserted,
    upserted,
    attempted,
    fetched,
    feedCount: feedUrls.length,
    errors,
  };
}
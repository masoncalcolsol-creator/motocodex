import "server-only";

import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export type MotoItem = {
  id: string;
  kind: "news" | "video" | "social";
  platform: "web" | "youtube" | "instagram" | "podcast";
  title: string;
  url: string;
  sourceKey: string;
  sourceName: string;
  publishedAt: string | null;
  createdAt: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  importance: number;
  summary: string | null;
};

export type MotoDataResult = {
  items: MotoItem[];
  mode: "supabase" | "live-rss" | "static-seed" | "empty";
  errors: string[];
  fetchedAt: string;
  sourceCount: number;
};

type SourceDefinition = {
  key: string;
  name: string;
  url: string;
  tier: 1 | 2 | 3;
  kind: "news" | "youtube" | "podcast";
};

export const NEWS_SOURCES: SourceDefinition[] = [
  { key: "racerx", name: "Racer X", url: "https://racerxonline.com/feeds/rss/posts", tier: 1, kind: "news" },
  { key: "pulpmx", name: "PulpMX", url: "https://pulpmx.com/feed", tier: 1, kind: "news" },
  { key: "vitalmx", name: "Vital MX", url: "https://feeds.vitalmx.com/vitalmxhomepage?format=xml", tier: 1, kind: "news" },
  { key: "cyclenews", name: "Cycle News", url: "https://www.cyclenews.com/feed/", tier: 1, kind: "news" },
  { key: "mxa", name: "Motocross Action", url: "https://motocrossactionmag.com/feed", tier: 2, kind: "news" },
  { key: "dirtbike", name: "Dirt Bike Magazine", url: "https://dirtbikemagazine.com/feed", tier: 2, kind: "news" },
  { key: "mxvice", name: "MX Vice", url: "https://mxvice.com/feed", tier: 2, kind: "news" },
  { key: "gatedrop", name: "GateDrop", url: "https://gatedrop.com/feed", tier: 2, kind: "news" },
  { key: "directmx", name: "Direct Motocross", url: "https://directmotocross.com/feed", tier: 2, kind: "news" },
  { key: "motocrosspress", name: "Motocross Press", url: "https://motocrosspress.blogspot.com/feeds/posts/default?alt=rss", tier: 3, kind: "news" },
];

export const SOCIAL_SOURCES: SourceDefinition[] = [
  { key: "yt-vitalmx", name: "Vital MX", url: "https://rss.app/feeds/eEJ0JEjmJHAQvd5j.xml", tier: 1, kind: "youtube" },
  { key: "yt-racerx", name: "Racer X", url: "https://rss.app/feeds/jn29gpgjQIhmLUZb.xml", tier: 1, kind: "youtube" },
  { key: "yt-maineventmoto", name: "Main Event Moto", url: "https://rss.app/feeds/K5nHxSHCDnctzH01.xml", tier: 2, kind: "youtube" },
  { key: "yt-mattburkeen", name: "Matt Burkeen", url: "https://rss.app/feeds/K1Q4dPeXaIE44PuN.xml", tier: 2, kind: "youtube" },
];

const RIDERS: Array<[string, RegExp]> = [
  ["jett-lawrence", /\bjett\s+lawrence\b|\bjett\b/i],
  ["hunter-lawrence", /\bhunter\s+lawrence\b/i],
  ["haiden-deegan", /\bhaiden\s+deegan\b|\bdeegan\b/i],
  ["eli-tomac", /\beli\s+tomac\b|\btomac\b/i],
  ["chase-sexton", /\bchase\s+sexton\b|\bsexton\b/i],
  ["cooper-webb", /\bcooper\s+webb\b|\bwebb\b/i],
  ["ken-roczen", /\bken\s+roczen\b|\broczen\b/i],
  ["jason-anderson", /\bjason\s+anderson\b/i],
  ["malcolm-stewart", /\bmalcolm\s+stewart\b/i],
  ["rj-hampshire", /\brj\s+hampshire\b|\bhampshire\b/i],
  ["jo-shimoda", /\bjo\s+shimoda\b|\bshimoda\b/i],
  ["tom-vialle", /\btom\s+vialle\b|\bvialle\b/i],
  ["levi-kitchen", /\blevi\s+kitchen\b|\bkitchen\b/i],
  ["chance-hymas", /\bchance\s+hymas\b|\bhymas\b/i],
];

const BRANDS: Array<[string, RegExp]> = [
  ["honda", /\bhonda\b|\bcrf\b/i],
  ["yamaha", /\byamaha\b|\byzf\b/i],
  ["kawasaki", /\bkawasaki\b|\bkx\b/i],
  ["ktm", /\bktm\b/i],
  ["husqvarna", /\bhusqvarna\b|\bhusky\b/i],
  ["gasgas", /\bgasgas\b/i],
  ["suzuki", /\bsuzuki\b|\brm-z\b/i],
  ["triumph", /\btriumph\b/i],
  ["ducati", /\bducati\b/i],
];

const TOPICS: Array<[string, RegExp]> = [
  ["supercross", /\bsupercross\b|\b450sx\b|\b250sx\b|\bsx\b/i],
  ["motocross", /\bmotocross\b|\bpro motocross\b|\b450mx\b|\b250mx\b/i],
  ["smx", /\bsupermotocross\b|\bsmx\b/i],
  ["mxgp", /\bmxgp\b|\bmx2\b|\bworld motocross\b/i],
  ["wsx", /\bworld supercross\b|\bwsx\b/i],
  ["arenacross", /\barenacross\b/i],
  ["amateur", /\bloretta\b|\bamateur\b|\bsx futures\b|\bsmx next\b/i],
  ["results", /\bresults?\b|\bqualifying\b|\bstandings?\b|\bpoints?\b|\bmain event\b/i],
  ["injury", /\binjur(y|ies)\b|\bfractur(e|ed)\b|\bconcussion\b|\bacl\b|\bout for\b/i],
  ["silly-season", /\bsigned\b|\bcontract\b|\bjoins?\b|\bteam move\b|\bsilly season\b/i],
  ["bike-tech", /\bsetup\b|\bsuspension\b|\bfork\b|\bshock\b|\bengine\b|\bprototype\b|\btest bike\b/i],
  ["breaking", /\bbreaking\b|\bconfirmed\b|\bofficial\b|\bannounced\b/i],
];

function safeDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stripHtml(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImage(value: string | undefined | null): string | null {
  const match = String(value ?? "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function stableId(sourceKey: string, url: string): string {
  let hash = 2166136261;
  const value = `${sourceKey}:${url}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${sourceKey}-${(hash >>> 0).toString(36)}`;
}

export function inferTags(title: string, summary = ""): string[] {
  const text = `${title} ${summary}`;
  const tags = new Set<string>();

  for (const [tag, expression] of RIDERS) if (expression.test(text)) tags.add(tag);
  for (const [tag, expression] of BRANDS) if (expression.test(text)) tags.add(tag);
  for (const [tag, expression] of TOPICS) if (expression.test(text)) tags.add(tag);

  if (!Array.from(tags).some((tag) => ["supercross", "motocross", "smx", "mxgp", "wsx", "arenacross", "amateur"].includes(tag))) {
    tags.add("moto");
  }

  return Array.from(tags);
}

function importanceFor(tier: number, title: string, publishedAt: string | null): number {
  let score = tier === 1 ? 70 : tier === 2 ? 48 : 30;
  if (/breaking|confirmed|official|champion|injury|out for|results|standings/i.test(title)) score += 12;
  if (publishedAt) {
    const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000);
    score += Math.max(0, 18 - ageHours / 6);
  }
  return Number(score.toFixed(2));
}

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  return createClient(url, anon, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: init?.signal ?? AbortSignal.timeout(6_000),
        }),
    },
  });
}

async function fetchFeed(source: SourceDefinition, maxItems: number): Promise<MotoItem[]> {
  const response = await fetch(source.url, {
    headers: {
      "user-agent": "MotoCODEX/3.0 (+https://motocodex.vercel.app)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7_000),
  });

  if (!response.ok) throw new Error(`${source.name}: ${response.status}`);

  const xml = await response.text();
  const parser = new Parser({
    customFields: {
      item: [
        ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
        ["media:content", "mediaContent", { keepArray: false }],
        ["content:encoded", "contentEncoded"],
      ],
    },
  });
  const parsed = await parser.parseString(xml);
  const items = Array.isArray(parsed.items) ? parsed.items.slice(0, maxItems) : [];

  return items.flatMap((entry: any) => {
    const url = String(entry.link || entry.guid || "").trim();
    const title = stripHtml(entry.title);
    if (!url || !title) return [];

    const publishedAt =
      safeDate(entry.isoDate) ||
      safeDate(entry.pubDate) ||
      safeDate(entry.published) ||
      safeDate(entry.updated);
    const summary = stripHtml(entry.contentSnippet || entry.content || entry.summary || entry.contentEncoded).slice(0, 420) || null;
    const thumbnail =
      entry.mediaThumbnail?.$?.url ||
      entry.mediaThumbnail?.url ||
      entry.mediaContent?.$?.url ||
      entry.enclosure?.url ||
      firstImage(entry.contentEncoded || entry.content || entry.summary) ||
      null;
    const platform = source.kind === "youtube" ? "youtube" : source.kind === "podcast" ? "podcast" : "web";

    return [{
      id: stableId(source.key, url),
      kind: source.kind === "news" ? "news" : source.kind === "youtube" ? "video" : "social",
      platform,
      title,
      url,
      sourceKey: source.key,
      sourceName: source.name,
      publishedAt,
      createdAt: null,
      thumbnailUrl: thumbnail,
      tags: inferTags(title, summary ?? ""),
      importance: importanceFor(source.tier, title, publishedAt),
      summary,
    } satisfies MotoItem];
  });
}

function dedupeAndSort(items: MotoItem[]): MotoItem[] {
  const seen = new Map<string, MotoItem>();
  for (const item of items) {
    const key = item.url.replace(/\/$/, "").toLowerCase();
    const previous = seen.get(key);
    if (!previous || item.importance > previous.importance) seen.set(key, item);
  }

  return Array.from(seen.values()).sort((left, right) => {
    const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
    const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
    return rightTime - leftTime || right.importance - left.importance;
  });
}

async function liveFeedResult(sources: SourceDefinition[], perSource: number, limit: number): Promise<MotoDataResult> {
  const errors: string[] = [];
  const settled = await Promise.allSettled(sources.map((source) => fetchFeed(source, perSource)));
  const items: MotoItem[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else errors.push(`${sources[index].name}: ${String(result.reason?.message ?? result.reason)}`);
  });

  const sorted = dedupeAndSort(items).slice(0, limit);
  return {
    items: sorted,
    mode: sorted.length ? "live-rss" : "empty",
    errors,
    fetchedAt: new Date().toISOString(),
    sourceCount: sources.length - errors.length,
  };
}

export async function getNews(limit = 260): Promise<MotoDataResult> {
  const errors: string[] = [];
  const supabase = publicSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("news_items")
        .select("id,title,url,source_key,source_name,tags,importance,thumbnail_url,published_at,created_at")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      const items = (data ?? []).map((row: any) => ({
        id: String(row.id),
        kind: "news" as const,
        platform: "web" as const,
        title: String(row.title ?? "Untitled"),
        url: String(row.url),
        sourceKey: String(row.source_key ?? "motocodex"),
        sourceName: String(row.source_name || row.source_key || "MotoCODEX"),
        publishedAt: row.published_at ?? null,
        createdAt: row.created_at ?? null,
        thumbnailUrl: row.thumbnail_url ?? null,
        tags: Array.isArray(row.tags) ? row.tags.map(String) : inferTags(String(row.title ?? "")),
        importance: Number(row.importance ?? 40),
        summary: null,
      }));

      if (items.length) {
        return { items, mode: "supabase", errors, fetchedAt: new Date().toISOString(), sourceCount: new Set(items.map((item) => item.sourceKey)).size };
      }
    } catch (error: any) {
      errors.push(`Supabase news unavailable: ${String(error?.message ?? error)}`);
    }
  } else {
    errors.push("Supabase public environment is not configured.");
  }

  const fallback = await liveFeedResult(NEWS_SOURCES, 24, limit);
  return { ...fallback, errors: [...errors, ...fallback.errors] };
}

export async function getSocial(limit = 500): Promise<MotoDataResult> {
  const errors: string[] = [];
  const supabase = publicSupabase();

  if (supabase) {
    try {
      const [{ data: posts, error: postsError }, { data: sources, error: sourceError }] = await Promise.all([
        supabase
          .from("social_posts")
          .select("id,platform,source_id,url,title,thumbnail_url,published_at,created_at")
          .in("platform", ["youtube", "instagram"])
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false })
          .limit(limit),
        supabase.from("social_sources").select("id,title,handle,platform").eq("enabled", true),
      ]);

      if (postsError) throw new Error(postsError.message);
      if (sourceError) errors.push(`Source labels: ${sourceError.message}`);

      const sourceMap = new Map((sources ?? []).map((source: any) => [String(source.id), source]));
      const items = (posts ?? []).map((row: any) => {
        const source: any = sourceMap.get(String(row.source_id));
        const platform = row.platform === "instagram" ? "instagram" : "youtube";
        const title = String(row.title || `${platform} post`);
        return {
          id: String(row.id),
          kind: platform === "youtube" ? "video" as const : "social" as const,
          platform,
          title,
          url: String(row.url),
          sourceKey: String(row.source_id ?? platform),
          sourceName: String(source?.title || (source?.handle ? `@${source.handle}` : "MotoFEEDS")),
          publishedAt: row.published_at ?? null,
          createdAt: row.created_at ?? null,
          thumbnailUrl: row.thumbnail_url ?? null,
          tags: inferTags(title),
          importance: 50,
          summary: null,
        } satisfies MotoItem;
      });

      if (items.length) {
        return { items, mode: "supabase", errors, fetchedAt: new Date().toISOString(), sourceCount: new Set(items.map((item) => item.sourceKey)).size };
      }
    } catch (error: any) {
      errors.push(`Supabase social feed unavailable: ${String(error?.message ?? error)}`);
    }
  } else {
    errors.push("Supabase public environment is not configured.");
  }

  const fallback = await liveFeedResult(SOCIAL_SOURCES, 24, limit);
  return { ...fallback, errors: [...errors, ...fallback.errors] };
}

export function filterMotoItems(
  items: MotoItem[],
  options: { query?: string; tag?: string; platform?: string },
): MotoItem[] {
  const query = String(options.query ?? "").trim().toLowerCase();
  const tag = String(options.tag ?? "").trim().toLowerCase();
  const platform = String(options.platform ?? "").trim().toLowerCase();

  return items.filter((item) => {
    if (platform && platform !== "all" && item.platform !== platform) return false;
    if (tag && tag !== "all" && !item.tags.includes(tag)) return false;
    if (!query) return true;

    return [item.title, item.sourceName, item.summary ?? "", item.tags.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function topTags(items: MotoItem[], limit = 18): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, limit);
}

import { XMLParser } from "fast-xml-parser";
import { normalizeText } from "./utils";

export type RssItem = { title: string; link?: string; pubDate?: string; description?: string; };

export async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, { headers: { "user-agent": "MotoCodexBot/0.1" } });
  if (!res.ok) throw new Error(`RSS fetch failed ${res.status} ${url}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const channel = data?.rss?.channel;
  const items = channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];

  return list
    .filter(Boolean)
    .map((it: any) => ({
      title: normalizeText(it.title),
      link: it.link,
      pubDate: it.pubDate,
      description: normalizeText(it.description ?? it["content:encoded"] ?? ""),
    }))
    .filter((x: any) => x.title);
}

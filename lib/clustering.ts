import { sha1, guessLeague, keywordBucket, normalizeText } from "./utils";

export type NewsItemLite = {
  id: string;
  title: string;
  summary: string | null;
  league: string | null;
  entities: string[] | null;
  tags: string[] | null;
};

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export function buildClusterDraft(item: NewsItemLite) {
  const text = normalizeText(`${item.title} ${item.summary ?? ""}`);
  const league = item.league || guessLeague(text);
  const entities = item.entities?.length ? item.entities : [];
  const primary = entities[0] || keywordBucket(text);
  const cluster_key = `${league}_${slug(primary)}_${sha1(primary).slice(0,6)}`;
  const title = entities[0] ? `${league}: ${entities[0]} update` : `${league}: ${primary}`;
  return { cluster_key, title, league, entities, tags: item.tags ?? [] };
}

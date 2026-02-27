import { clamp } from "./utils";

const IMPORTANT_KEYWORDS = [
  "injury",
  "out",
  "return",
  "surgery",
  "broken",
  "update",
  "results",
  "qualifying",
  "main event",
  "heat",
  "gate",
  "penalty",
  "disqualified",
  "protest",
  "contract",
  "signs",
  "team",
  "suspension",
  "rule",
  "points",
  "standings",
  "championship",
  "bike",
  "engine",
  "testing",
];

const MOMENTUM_KEYWORDS = [
  "breaking",
  "confirmed",
  "official",
  "announced",
  "today",
  "tonight",
  "this weekend",
];

export function scoreCredibility(defaultCred = 70, sourceName = "", url = ""): number {
  let c = defaultCred;

  const s = (sourceName || "").toLowerCase();
  const u = (url || "").toLowerCase();

  if (u.includes("feld") || u.includes("supercross") || u.includes("promotocross")) c += 10;
  if (s.includes("official")) c += 5;
  if (s.includes("forum") || u.includes("forum")) c -= 15;
  if (u.includes("facebook.com") || u.includes("tiktok.com")) c -= 5;

  return clamp(c, 0, 100);
}

export function scoreImportance(title: string, body: string, entities: string[] = []): number {
  const t = (title || "").toLowerCase();
  const b = (body || "").toLowerCase();
  let score = 40;

  for (const kw of IMPORTANT_KEYWORDS) {
    if (t.includes(kw)) score += 8;
    else if (b.includes(kw)) score += 4;
  }

  score += Math.min(entities.length * 3, 18);

  if (t.length > 20 && t.length < 90) score += 4;

  return clamp(score, 0, 100);
}

export function scoreMomentum(publishedAt: Date | null, title: string, body: string): number {
  let score = 45;
  const now = Date.now();

  if (publishedAt) {
    const ageHours = Math.max(0, (now - publishedAt.getTime()) / 36e5);
    const recencyBoost = Math.max(0, 35 - (ageHours / 24) * 12);
    score += recencyBoost;
  }

  const t = (title || "").toLowerCase();
  const b = (body || "").toLowerCase();
  for (const kw of MOMENTUM_KEYWORDS) {
    if (t.includes(kw) || b.includes(kw)) score += 6;
  }

  return clamp(Math.round(score), 0, 100);
}

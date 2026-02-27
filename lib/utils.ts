// lib/utils.ts

export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function sha1(input: string): string {
  // Safe build placeholder (not used at build time)
  return input;
}

export function guessLeague(titleOrText: string): "sx" | "mx" | "moto" | "auto" | "general" {
  const t = normalizeText(titleOrText);

  if (
    t.includes("supercross") ||
    /\b250\b/.test(t) ||
    /\b450\b/.test(t) ||
    t.includes("main event") ||
    t.includes("whoops") ||
    t.includes("east") ||
    t.includes("west")
  ) return "sx";

  if (
    t.includes("motocross") ||
    t.includes("mxgp") ||
    t.includes("outdoor") ||
    t.includes("nationals") ||
    t.includes("ama pro motocross")
  ) return "mx";

  if (t.includes("moto") || t.includes("bike") || t.includes("rider")) return "moto";

  if (t.includes("nascar") || t.includes("f1") || t.includes("indycar") || t.includes("motogp")) return "auto";

  return "general";
}

export function keywordBucket(titleOrText: string):
  | "injuries"
  | "results"
  | "silly"
  | "media"
  | "industry"
  | "tech"
  | "gear"
  | "racing"
  | "other" {

  const t = normalizeText(titleOrText);

  if (t.includes("injur") || t.includes("hurt") || t.includes("surgery") || t.includes("fract")) return "injuries";
  if (t.includes("result") || t.includes("podium") || t.includes("winner") || t.includes("standings")) return "results";
  if (t.includes("rumor") || t.includes("sign") || t.includes("contract") || t.includes("team")) return "silly";
  if (t.includes("podcast") || t.includes("youtube") || t.includes("interview")) return "media";
  if (t.includes("sponsor") || t.includes("brand") || t.includes("launch") || t.includes("industry")) return "industry";
  if (t.includes("spec") || t.includes("engine") || t.includes("suspension") || t.includes("prototype")) return "tech";
  if (t.includes("gear") || t.includes("helmet") || t.includes("boot") || t.includes("review")) return "gear";
  if (t.includes("race") || t.includes("track") || t.includes("round") || t.includes("schedule")) return "racing";

  return "other";
}
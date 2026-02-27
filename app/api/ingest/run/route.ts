// FILE: C:\MotoCODEX\app\api\ingest\run\route.ts
// Replace the ENTIRE file with this.
//
// Features:
// - Pulls FEEDS list (centralized)
// - Per-feed breakdown (fetched/parsed/inserted/dupes/errors)
// - Deterministic base importance by tier (Phase 2.1 anti-monoculture)
// - Safe insert with "ignore duplicates" behavior (best-effort even if no constraints)
// - Works with Supabase Service Role for writes
//
// Env expected:
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - CRON_SECRET (optional, if you already gate cron/ingest)

import { NextResponse } from "next/server";
import RSSParser from "rss-parser";
import { createClient } from "@supabase/supabase-js";
import { FEEDS } from "../feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Breakdown = {
  key: string;
  name: string;
  url: string;
  tier: number;
  fetched: boolean;
  parsedCount: number;
  attempted: number;
  inserted: number;
  dupesOrSkipped: number;
  errors: string[];
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, service, { auth: { persistSession: false } });
}

function requireAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return; // if you don't gate it, don't block
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token !== secret) {
    throw new Error("Unauthorized (bad CRON_SECRET).");
  }
}

function baseImportanceForTier(tier: number) {
  // Phase 2.1: crude but effective.
  // Tier1 > Tier2 > Tier3. We’ll replace later with true source weights in ranking.
  if (tier === 1) return 9.0;
  if (tier === 2) return 6.0;
  return 3.0;
}

function pickUrl(item: any): string | null {
  return (
    (typeof item?.link === "string" && item.link) ||
    (typeof item?.guid === "string" && item.guid) ||
    null
  );
}

function pickTitle(item: any): string | null {
  return (typeof item?.title === "string" && item.title.trim()) ? item.title.trim() : null;
}

function safeIsoDate(item: any): string | null {
  const raw =
    item?.isoDate ||
    item?.pubDate ||
    item?.published ||
    item?.date ||
    null;

  if (!raw) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function GET(req: Request) {
  try {
    requireAuth(req);

    const supabase = supabaseAdmin();
    const parser = new RSSParser({
      timeout: 20000,
      headers: {
        "User-Agent": "MotoCODEX/2.0 (+vercel)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    const breakdown: Breakdown[] = [];

    for (const feed of FEEDS) {
      const b: Breakdown = {
        key: feed.key,
        name: feed.name,
        url: feed.url,
        tier: feed.tier,
        fetched: false,
        parsedCount: 0,
        attempted: 0,
        inserted: 0,
        dupesOrSkipped: 0,
        errors: [],
      };

      // Placeholder detection (so you don't forget RSS.app swap)
      if (feed.url.includes("REPLACE_ME_")) {
        b.errors.push("Feed URL is placeholder. Replace with your RSS.app feed URL.");
        breakdown.push(b);
        continue;
      }

      try {
        const parsed = await parser.parseURL(feed.url);
        b.fetched = true;

        const items = Array.isArray(parsed.items) ? parsed.items : [];
        b.parsedCount = items.length;

        // Limit per feed to avoid one source dumping 300 items and dominating
        const slice = items.slice(0, 40);

        for (const it of slice) {
          const url = pickUrl(it);
          const title = pickTitle(it);
          if (!url || !title) {
            b.dupesOrSkipped += 1;
            continue;
          }

          b.attempted += 1;

          const row: any = {
            source_key: feed.key,
            source_name: feed.name,
            title,
            url,
            // leave tags null (Phase 2 pods fallback + later tagging)
            tags: null,
            // deterministic base importance by tier
            importance: baseImportanceForTier(feed.tier),
            // if your table has created_at default now(), don’t set it; but setting is harmless if allowed
            created_at: safeIsoDate(it) ?? undefined,
          };

          // Best-effort insert:
          // - If you have a unique constraint on url, duplicates will error; we treat as skipped.
          // - If you don't, it will insert duplicates; but your existing pipeline likely already has a unique index.
          const { error } = await supabase.from("news_items").insert(row);

          if (error) {
            // Treat duplicate-ish errors as skipped; otherwise record it.
            const msg = error.message || "insert error";
            const isDupe =
              msg.toLowerCase().includes("duplicate") ||
              msg.toLowerCase().includes("unique") ||
              msg.toLowerCase().includes("violates");

            if (isDupe) {
              b.dupesOrSkipped += 1;
            } else {
              b.errors.push(msg);
            }
          } else {
            b.inserted += 1;
          }
        }
      } catch (e: any) {
        b.errors.push(e?.message ? String(e.message) : "feed parse failed");
      }

      breakdown.push(b);
    }

    const totals = breakdown.reduce(
      (acc, b) => {
        acc.feeds += 1;
        acc.attempted += b.attempted;
        acc.inserted += b.inserted;
        acc.skipped += b.dupesOrSkipped;
        acc.feedErrors += b.errors.length ? 1 : 0;
        return acc;
      },
      { feeds: 0, attempted: 0, inserted: 0, skipped: 0, feedErrors: 0 }
    );

    return NextResponse.json({ ok: true, totals, breakdown });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ? String(e.message) : "Unknown error" },
      { status: 500 }
    );
  }
}
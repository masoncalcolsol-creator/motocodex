import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sha1, normalizeText, guessLeague } from "@/lib/utils";
import { scoreImportance, scoreMomentum } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseAdmin;
    const body = await req.json();

    const title = normalizeText(body.title || "");
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const url = body.url ? String(body.url) : null;
    const summary = body.summary ? String(body.summary) : null;
    const sourceKey = body.sourceKey ? String(body.sourceKey) : "manual";
    const published_at = body.publishedAt ? String(body.publishedAt) : null;

    const dedupe_hash = sha1(`${title}|${url || ""}`.toLowerCase());
    const league = guessLeague(`${title} ${summary || ""}`);
    const importance = scoreImportance(title, summary || "", []);
    const momentum = 0;

    const { data: src } = await sb.from("sources").select("base_credibility").eq("source_key", sourceKey).maybeSingle();
    const credibility = Number(src?.base_credibility ?? 0.7);

    const { error } = await sb.from("news_items").insert({
      source_key: sourceKey,
      source_type: "manual",
      url,
      title,
      summary,
      content: null,
      league,
      entities: [],
      tags: [],
      published_at,
      dedupe_hash,
      credibility,
      importance,
      momentum,
      is_breaking: (importance >= 0.80 && momentum >= 0.70)
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}






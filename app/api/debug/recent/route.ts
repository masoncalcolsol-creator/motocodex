// FILE: app/api/debug/recent/route.ts
// Replace the ENTIRE file with this.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "20", 10) || 20,
    100
  );

  // supabaseAdmin might be a client OR a function returning a client (we support both)
  const sbAny: any = supabaseAdmin as any;
  const sb = typeof sbAny === "function" ? sbAny() : sbAny;

  const { data, error } = await sb
    .from("news_items")
    .select("id,title,source,source_url,published_at,created_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    limit,
    count: data?.length || 0,
    rows: data || [],
  });
}
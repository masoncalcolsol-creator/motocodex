import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCronAuth } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    assertCronAuth(req);

    // supabaseAdmin is a client, NOT a function
    const sb = supabaseAdmin;

    // Build-safe stub: keep your real scoring logic elsewhere.
    // This unblocks Vercel build.
    const { count, error } = await sb
      .from("news_items")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, scored: 0, items: count || 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCronAuth } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    assertCronAuth(req);

    const sb = supabaseAdmin;

    const { data: items, error } = await sb
      .from("news_items")
      .select("id,title,url,source_key,source_name,importance,created_at")
      .eq("is_active", true)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(420);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // If your clustering logic lives elsewhere, keep it there.
    // This route only needed the supabaseAdmin call fixed for build.
    return NextResponse.json({ ok: true, count: (items || []).length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}

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

    const day = new Date().toISOString().slice(0, 10);

    const { error: delErr } = await sb
      .from("episode_facts")
      .delete()
      .eq("day", day);

    if (delErr) {
      return NextResponse.json(
        { ok: false, error: delErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, day });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown" },
      { status: 500 }
    );
  }
}

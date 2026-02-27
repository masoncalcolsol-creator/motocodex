import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sb = supabaseAdmin;

  const day = new Date().toISOString().slice(0, 10);

  const { data: facts, error } = await sb
    .from("episode_facts")
    .select("*")
    .gte("created_at", `${day}T00:00:00.000Z`)
    .lte("created_at", `${day}T23:59:59.999Z`)
    .order("importance", { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, day, facts: facts || [] });
}

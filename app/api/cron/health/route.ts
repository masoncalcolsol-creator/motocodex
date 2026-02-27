import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "INVALID_URL";
    }
  })();

  return NextResponse.json({
    ok: true,
    supabaseHost: host,
    hasAnonKey: hasAnon,
    nodeEnv: process.env.NODE_ENV,
  });
}
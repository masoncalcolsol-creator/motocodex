import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "INGEST_SECRET",
    "MOTOCODEX_RSS_FEEDS",
    "RSS_FEEDS",
  ];

  const present = Object.fromEntries(
    keys.map((k) => [k, Boolean(process.env[k])])
  );

  return NextResponse.json({ present });
}
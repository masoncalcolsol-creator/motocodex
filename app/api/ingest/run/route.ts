// app/api/ingest/run/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/runIngest";

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  try {
    assertIngestAuth(req);

    const result = await runIngest();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e: any) {
    const msg = e?.message || "unknown";
    const status =
      msg === "Unauthorized" || msg.startsWith("Missing ")
        ? 401
        : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

function assertIngestAuth(req: NextRequest) {
  const candidates = [
    process.env.INGEST_TOKEN,
    process.env.INGEST_SECRET,
    process.env.CRON_SECRET,
    process.env.ADMIN_TOKEN,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());

  if (candidates.length === 0) throw new Error("Missing ingest secret");

  const url = new URL(req.url);

  // Cron-safe: allow token via query param
  const token =
    url.searchParams.get("token") ||
    url.searchParams.get("secret") ||
    url.searchParams.get("key") ||
    "";

  // Backward-compatible: allow Authorization header too
  const auth = req.headers.get("authorization") || "";
  const headerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const provided = (token || headerToken).trim();

  if (!provided) throw new Error("Unauthorized");

  const ok = candidates.includes(provided);
  if (!ok) throw new Error("Unauthorized");
}
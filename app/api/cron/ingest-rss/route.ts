export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/runIngest";

export async function GET(req: NextRequest) {
  try {
    assertCronAuth(req);

    const result = await runIngest();

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown" },
      { status: 500 }
    );
  }
}

function assertCronAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET || "";

  if (!expected) throw new Error("Missing CRON_SECRET");
  if (auth !== `Bearer ${expected}`) throw new Error("Unauthorized");
}
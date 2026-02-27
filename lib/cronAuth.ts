import type { NextRequest } from "next/server";

export function assertCronAuth(req: NextRequest) {
  const expected = process.env.CRON_SECRET || "";

  if (!expected) throw new Error("Missing CRON_SECRET env var");

  const auth = req.headers.get("authorization") || "";
  const xcron =
    req.headers.get("x-cron-secret") ||
    req.headers.get("x-vercel-cron-secret") ||
    "";

  if (auth === `Bearer ${expected}`) return;
  if (xcron === expected) return;

  throw new Error("Unauthorized");
}
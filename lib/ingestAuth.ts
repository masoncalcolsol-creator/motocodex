import type { NextRequest } from "next/server";

export function assertIngestAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.INGEST_SECRET || "";

  if (!expected) {
    throw new Error("Missing INGEST_SECRET env var");
  }

  if (auth !== `Bearer ${expected}`) {
    throw new Error("Unauthorized");
  }
}
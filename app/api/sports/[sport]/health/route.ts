import { NextResponse } from "next/server";
import { SPORTS, type SportKey } from "../../../../../lib/sports-beta";
export function GET(_: Request, { params }: { params: { sport: string } }) {
  const sport = params.sport as SportKey;
  const config = SPORTS[sport];
  if (!config) return NextResponse.json({ ok: false, error: "unknown sport" }, { status: 404 });
  return NextResponse.json({ ok: true, sport, product: [config.codex, config.feeds, config.app], mobile_beta: true, at: new Date().toISOString() });
}

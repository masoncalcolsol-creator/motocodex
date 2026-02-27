// FILE: C:\MotoCODEX\lib\guards.ts

import { headers } from "next/headers";

export function getBearerTokenFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export function assertCronSecretOrThrow(request: Request) {
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("token");

  const auth = request.headers.get("authorization");
  const tokenFromHeader = getBearerTokenFromAuthHeader(auth);

  const provided = tokenFromQuery || tokenFromHeader;
  const expected = process.env.CRON_SECRET;

  if (!expected) throw new Error("Missing env var: CRON_SECRET");
  if (!provided || provided !== expected) {
    const e = new Error("Unauthorized (bad CRON_SECRET)");
    // @ts-ignore
    e.status = 401;
    throw e;
  }
}

export function assertAdminTokenOrThrow(searchParams: Record<string, string | string[] | undefined>) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) throw new Error("Missing env var: ADMIN_TOKEN");

  const tokenRaw = searchParams["token"];
  const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;

  // Also allow x-admin-token header for convenience (optional)
  const h = headers();
  const headerToken = h.get("x-admin-token");

  const provided = token || headerToken;
  if (!provided || provided !== expected) {
    const e = new Error("Unauthorized (bad ADMIN_TOKEN)");
    // @ts-ignore
    e.status = 401;
    throw e;
  }
}
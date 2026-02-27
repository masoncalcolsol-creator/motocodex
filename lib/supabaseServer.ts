// FILE: C:\MotoCODEX\lib\supabaseServer.ts

import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Server-only Supabase client (service role).
 * - DO NOT import into client components.
 */
export function supabaseServer() {
  const url = requiredEnv("SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}
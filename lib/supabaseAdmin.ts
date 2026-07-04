import "server-only";
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

/**
 * Keep the module import-safe so Vercel Preview and CI can compile without
 * production secrets. Production uses the real environment values. A preview
 * request that reaches a Supabase-backed API will receive its normal handled
 * request error rather than crashing the entire deployment during build.
 */
export const supabaseConfigured = Boolean(url && serviceRoleKey);

export const supabaseAdmin = createClient(
  url || "https://preview-not-configured.supabase.co",
  serviceRoleKey || "preview-build-placeholder",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

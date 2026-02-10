// app/api/admin/posts/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// Very light protection so random people can’t hit this API.
// Add Vercel env var: ADMIN_TOKEN = any long random string.
// Then send it from the admin page.
function requireAdmin(req: Request) {
  const token = req.headers.get("x-admin-token") || "";
  const expected = process.env.ADMIN_TOKEN || "";
  return expected.length > 0 && token === expected;
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,url,source,series,created_at,is_breaking,is_pinned,pin_rank,is_hidden")
    .eq("is_hidden", false)
    .order("is_breaking", { ascending: false })
    .order("is_pinned", { ascending: false })
    .order("pin_rank", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.id || typeof body.id !== "string" || !body.updates) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { id, updates } = body as { id: string; updates: Record<string, any> };

  // If setting a post to breaking=true, automatically clear other breaking posts
  if (updates.is_breaking === true) {
    await supabase.from("posts").update({ is_breaking: false }).eq("is_breaking", true);
  }

  const { data, error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", id)
    .select("id,title,url,source,series,created_at,is_breaking,is_pinned,pin_rank,is_hidden")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

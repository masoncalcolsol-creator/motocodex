// FILE: C:\MotoCODEX\app\admin\sources\page.tsx

import { supabaseServer } from "@/lib/supabaseServer";
import { assertAdminTokenOrThrow } from "@/lib/guards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  assertAdminTokenOrThrow(searchParams);

  const supabase = supabaseServer();

  const token = first(searchParams, "token");

  const { data: sources, error } = await supabase
    .from("social_sources")
    .select("*")
    .eq("platform", "youtube")
    .order("enabled", { ascending: false })
    .order("tier", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1>Admin • Sources</h1>
        <pre>ERROR: {error.message}</pre>
      </div>
    );
  }

  async function addSourceAction(formData: FormData) {
    "use server";

    const supabase = supabaseServer();

    const title = String(formData.get("title") ?? "").trim() || null;
    const handle = String(formData.get("handle") ?? "").trim() || null;
    const channel_id = String(formData.get("channel_id") ?? "").trim() || null;

    const tierRaw = String(formData.get("tier") ?? "3").trim();
    const tier = Number.isFinite(Number(tierRaw)) ? Number(tierRaw) : 3;

    const enabled = String(formData.get("enabled") ?? "on") === "on";

    const feed_url =
      channel_id ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel_id}` : null;

    if (!channel_id) {
      throw new Error("channel_id is required for v1 (YT channel_id RSS).");
    }

    const { error } = await supabase.from("social_sources").insert({
      platform: "youtube",
      title,
      handle,
      channel_id,
      feed_url,
      tier,
      enabled,
    });

    if (error) throw new Error(error.message);
  }

  async function toggleEnabledAction(formData: FormData) {
    "use server";

    const supabase = supabaseServer();
    const id = String(formData.get("id") ?? "");
    const enabled = String(formData.get("enabled") ?? "false") === "true";

    if (!id) throw new Error("Missing id");

    const { error } = await supabase
      .from("social_sources")
      .update({ enabled })
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  async function updateTierAction(formData: FormData) {
    "use server";

    const supabase = supabaseServer();
    const id = String(formData.get("id") ?? "");
    const tier = Number(String(formData.get("tier") ?? "3"));

    if (!id) throw new Error("Missing id");

    const { error } = await supabase
      .from("social_sources")
      .update({ tier: Number.isFinite(tier) ? tier : 3 })
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Admin • Sources (YouTube)</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Add/edit enabled YouTube channels for MotoFEEDS v1. (Gated by <code>ADMIN_TOKEN</code>)
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <a
          href={`/admin/feeds?token=${encodeURIComponent(token)}`}
          style={{ textDecoration: "none" }}
        >
          <button style={{ padding: "10px 12px", cursor: "pointer" }}>
            ← Feeds Health
          </button>
        </a>
      </div>

      <div style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Add YouTube Channel (v1 = channel_id only)</h2>

        <form action={addSourceAction} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>Title (display name)</label>
            <input name="title" placeholder="Racer X" style={{ padding: 10 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>Handle (optional)</label>
            <input name="handle" placeholder="racerxonline" style={{ padding: 10 }} />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>
              Channel ID (required)
            </label>
            <input name="channel_id" placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" style={{ padding: 10, fontFamily: "ui-monospace, Menlo, monospace" }} />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Tier</label>
              <input name="tier" defaultValue="3" style={{ padding: 10, width: 80 }} />
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
              <input type="checkbox" name="enabled" defaultChecked />
              Enabled
            </label>

            <button type="submit" style={{ padding: "10px 12px", cursor: "pointer", marginTop: 22 }}>
              Add Source
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f6f6f6" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Enabled</th>
              <th style={{ textAlign: "left", padding: 10 }}>Tier</th>
              <th style={{ textAlign: "left", padding: 10 }}>Title</th>
              <th style={{ textAlign: "left", padding: 10 }}>Handle</th>
              <th style={{ textAlign: "left", padding: 10 }}>Channel ID</th>
              <th style={{ textAlign: "left", padding: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(sources ?? []).map((s: any) => (
              <tr key={s.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10 }}>{s.enabled ? "✅" : "—"}</td>

                <td style={{ padding: 10 }}>
                  <form action={updateTierAction} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="hidden" name="id" value={s.id} />
                    <input
                      name="tier"
                      defaultValue={String(s.tier ?? 3)}
                      style={{ padding: 8, width: 70 }}
                    />
                    <button type="submit" style={{ padding: "8px 10px", cursor: "pointer" }}>
                      Save
                    </button>
                  </form>
                </td>

                <td style={{ padding: 10, fontWeight: 600 }}>{s.title ?? "—"}</td>
                <td style={{ padding: 10 }}>{s.handle ? `@${s.handle}` : "—"}</td>

                <td style={{ padding: 10, fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {s.channel_id ?? "—"}
                </td>

                <td style={{ padding: 10 }}>
                  <form action={toggleEnabledAction} style={{ display: "inline-flex", gap: 8 }}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="enabled" value={String(!s.enabled)} />
                    <button type="submit" style={{ padding: "8px 10px", cursor: "pointer" }}>
                      {s.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(sources ?? []).length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                  No sources yet. Add some above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.75 }}>
        Tip: bookmark <code>/admin/sources?token=YOUR_ADMIN_TOKEN</code>.
      </div>
    </div>
  );
}
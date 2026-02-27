// FILE: C:\MotoCODEX\app\admin\feeds\page.tsx

import { supabaseServer } from "@/lib/supabaseServer";
import { assertAdminTokenOrThrow } from "@/lib/guards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function fmt(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export default async function AdminFeedsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  assertAdminTokenOrThrow(searchParams);

  const supabase = supabaseServer();

  const { data: sources, error: srcErr } = await supabase
    .from("social_sources")
    .select("*")
    .eq("platform", "youtube")
    .order("enabled", { ascending: false })
    .order("tier", { ascending: true })
    .order("created_at", { ascending: true });

  if (srcErr) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1>Admin • Feeds</h1>
        <pre>ERROR: {srcErr.message}</pre>
      </div>
    );
  }

  const srcList = sources ?? [];

  // Small scale N+1 (fine for MVP)
  const rows = [];
  for (const s of srcList) {
    const { data: runs } = await supabase
      .from("feed_ingest_runs")
      .select("*")
      .eq("source_id", s.id)
      .order("started_at", { ascending: false })
      .limit(1);

    const lastRun = (runs ?? [])[0] ?? null;

    rows.push({
      source: s,
      lastRun,
    });
  }

  const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Admin • Feeds (MotoFEEDS)</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        YouTube sources health + last ingest run. (Gated by <code>ADMIN_TOKEN</code>)
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <a
          href={`/admin/sources?token=${encodeURIComponent(token || "")}`}
          style={{ textDecoration: "none" }}
        >
          <button style={{ padding: "10px 12px", cursor: "pointer" }}>
            Sources Manager →
          </button>
        </a>

        <a
          href={`/api/feeds/youtube/run?token=${encodeURIComponent(process.env.CRON_SECRET || "")}`}
          style={{ textDecoration: "none" }}
        >
          <button style={{ padding: "10px 12px", cursor: "pointer" }}>
            Run ingest now (server CRON_SECRET env)*
          </button>
        </a>
      </div>

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
        *That button uses the server env <code>CRON_SECRET</code> at render time. If it’s not set, it won’t work.
      </p>

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f6f6f6" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Enabled</th>
              <th style={{ textAlign: "left", padding: 10 }}>Tier</th>
              <th style={{ textAlign: "left", padding: 10 }}>Title</th>
              <th style={{ textAlign: "left", padding: 10 }}>Channel ID</th>
              <th style={{ textAlign: "left", padding: 10 }}>Last ingested</th>
              <th style={{ textAlign: "left", padding: 10 }}>Last status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Fetched</th>
              <th style={{ textAlign: "left", padding: 10 }}>Inserted</th>
              <th style={{ textAlign: "left", padding: 10 }}>Last error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ source, lastRun }) => (
              <tr key={source.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10 }}>{source.enabled ? "✅" : "—"}</td>
                <td style={{ padding: 10 }}>{source.tier}</td>
                <td style={{ padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{source.title ?? "—"}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {source.handle ? `@${source.handle}` : ""}
                  </div>
                </td>
                <td style={{ padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {source.channel_id ?? "—"}
                </td>
                <td style={{ padding: 10 }}>{fmt(source.last_ingested_at)}</td>
                <td style={{ padding: 10 }}>
                  {source.last_ingest_status === "ok" ? "OK" : source.last_ingest_status === "error" ? "ERROR" : "—"}
                </td>
                <td style={{ padding: 10 }}>{lastRun?.fetched_count ?? "—"}</td>
                <td style={{ padding: 10 }}>{lastRun?.inserted_count ?? "—"}</td>
                <td style={{ padding: 10, maxWidth: 340 }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {source.last_error ?? lastRun?.error_text ?? "—"}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 12, opacity: 0.7 }}>
                  No sources yet. Add some in Sources Manager.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.75 }}>
        Tip: bookmark <code>/admin/feeds?token=YOUR_ADMIN_TOKEN</code>.
      </div>
    </div>
  );
}
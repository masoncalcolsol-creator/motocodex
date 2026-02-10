// app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Post = {
  id: string;
  title: string;
  url: string;
  source: string;
  series: string;
  created_at?: string;

  is_breaking: boolean;
  is_pinned: boolean;
  pin_rank: number;
  is_hidden: boolean;
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const headers = useMemo(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (token.trim()) h["x-admin-token"] = token.trim();
    return h;
  }, [token]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/posts", { headers });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Load failed (${res.status})`);
      }
      const data = (await res.json()) as Post[];
      setPosts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: string, updates: Partial<Post>) {
    setError("");
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, updates }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Update failed (${res.status})`);
      }
      const updated = (await res.json()) as Post;

      // If we set breaking=true, server cleared others. Reload to reflect that.
      if ((updates as any).is_breaking === true) {
        await load();
        return;
      }

      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (e: any) {
      setError(e?.message || "Update failed");
    }
  }

  useEffect(() => {
    // don’t auto-load without token
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>MotoCodex Admin</h1>
      <p style={{ marginTop: 6, color: "#555" }}>
        Toggle <b>Breaking</b>, <b>Pin</b>, and <b>Hide</b>. This page requires an admin token.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          style={{ width: 360, padding: "10px 12px", border: "1px solid #bbb", borderRadius: 6 }}
        />
        <button
          onClick={load}
          disabled={!token.trim() || loading}
          style={{ padding: "10px 14px", border: "1px solid #999", background: "white", borderRadius: 6, cursor: "pointer" }}
        >
          {loading ? "Loading..." : "Load posts"}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e66", background: "#fff3f3", borderRadius: 6 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16, borderTop: "1px solid #ddd" }} />

      <table style={{ width: "100%", marginTop: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={{ padding: "10px 6px" }}>Title</th>
            <th style={{ padding: "10px 6px" }}>Source</th>
            <th style={{ padding: "10px 6px" }}>Series</th>
            <th style={{ padding: "10px 6px" }}>Breaking</th>
            <th style={{ padding: "10px 6px" }}>Pinned</th>
            <th style={{ padding: "10px 6px" }}>Hide</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: "10px 6px" }}>
                <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#111", fontWeight: 700 }}>
                  {p.title}
                </a>
              </td>
              <td style={{ padding: "10px 6px", color: "#444" }}>{p.source}</td>
              <td style={{ padding: "10px 6px", color: "#444" }}>{p.series}</td>

              <td style={{ padding: "10px 6px" }}>
                <button
                  onClick={() => patch(p.id, { is_breaking: !p.is_breaking })}
                  style={{ padding: "6px 10px", border: "1px solid #999", background: "white", borderRadius: 6, cursor: "pointer" }}
                >
                  {p.is_breaking ? "Unset" : "Set"}
                </button>
              </td>

              <td style={{ padding: "10px 6px" }}>
                <button
                  onClick={() =>
                    patch(p.id, {
                      is_pinned: !p.is_pinned,
                      pin_rank: p.is_pinned ? 100 : 1,
                    })
                  }
                  style={{ padding: "6px 10px", border: "1px solid #999", background: "white", borderRadius: 6, cursor: "pointer" }}
                >
                  {p.is_pinned ? `Unpin (${p.pin_rank})` : "Pin"}
                </button>
              </td>

              <td style={{ padding: "10px 6px" }}>
                <button
                  onClick={() => patch(p.id, { is_hidden: !p.is_hidden })}
                  style={{ padding: "6px 10px", border: "1px solid #999", background: "white", borderRadius: 6, cursor: "pointer" }}
                >
                  {p.is_hidden ? "Unhide" : "Hide"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {posts.length === 0 && token.trim() ? (
        <div style={{ marginTop: 16, color: "#666" }}>No posts loaded yet.</div>
      ) : null}
    </div>
  );
}

"use client";
import { useState } from "react";

export default function IngestPage() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceKey, setSourceKey] = useState("manual");
  const [publishedAt, setPublishedAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const res = await fetch("/api/ingest/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, url, summary, sourceKey, publishedAt }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Saved ✅" : (data?.error || "Error"));
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900 }}>
      <h1>Manual Ingest</h1>
      <p>Paste a headline to test the system.</p>
      <div style={{ display: "grid", gap: 10 }}>
        <label>Title (required)
          <input value={title} onChange={(e)=>setTitle(e.target.value)} style={{ width: "100%", padding: 10 }} />
        </label>
        <label>URL (optional)
          <input value={url} onChange={(e)=>setUrl(e.target.value)} style={{ width: "100%", padding: 10 }} />
        </label>
        <label>Summary (optional)
          <textarea value={summary} onChange={(e)=>setSummary(e.target.value)} style={{ width: "100%", padding: 10, minHeight: 110 }} />
        </label>
        <label>Source Key
          <input value={sourceKey} onChange={(e)=>setSourceKey(e.target.value)} style={{ width: "100%", padding: 10 }} />
        </label>
        <label>Published At (optional ISO)
          <input value={publishedAt} onChange={(e)=>setPublishedAt(e.target.value)} placeholder="2026-02-19T12:00:00Z"
            style={{ width: "100%", padding: 10 }} />
        </label>
        <button onClick={submit} style={{ padding: 12, fontWeight: 700 }}>Save</button>
        {msg && <p><b>{msg}</b></p>}
      </div>
      <p style={{ marginTop: 16 }}>Next: <a href="/console">Console</a></p>
    </main>
  );
}

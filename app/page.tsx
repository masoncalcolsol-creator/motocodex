// app/page.tsx
import Link from "next/link";

type Post = {
  id: string;
  title: string;
  url: string;
  source: string;
  series: string;
  created_at: string;
};

const FILTERS = [
  { label: "All", series: "" },
  { label: "SX", series: "SX" },
  { label: "MX", series: "MX" },
  { label: "SMX", series: "SMX" },
  { label: "WSX", series: "WSX" },
  { label: "WMX", series: "WMX" },
  { label: "MXGP", series: "MXGP" },
  { label: "Amateur", series: "AM" },
  { label: "News", series: "GEN" },
  { label: "Video", series: "VID" },
];

function qp(params: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.length) u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

function getBaseUrl() {
  // Vercel sets this automatically
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Local dev fallback
  return "http://localhost:3000";
}

export default async function Home({
  searchParams,
}: {
  searchParams: { series?: string; q?: string; source?: string };
}) {
  const series = searchParams.series?.toUpperCase();
  const q = searchParams.q ?? "";
  const source = searchParams.source ?? "";

  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/api/feed${qp({ series, q, source })}`, {
    cache: "no-store",
  });

  const json = await res.json().catch(() => []);
  const posts: Post[] = Array.isArray(json) ? json : [];

  const breaking = posts[0];
  const rest = posts.slice(1);

  const col1: Post[] = [];
  const col2: Post[] = [];
  const col3: Post[] = [];
  rest.forEach((p, i) => (i % 3 === 0 ? col1 : i % 3 === 1 ? col2 : col3).push(p));

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "24px auto",
        padding: "0 16px",
        fontFamily: "Georgia, 'Times New Roman', Times, serif",
        color: "#111",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 56, fontWeight: 700 }}>MotoCodex</h1>
          <div style={{ marginTop: 8, fontFamily: "Arial, sans-serif", fontSize: 14, color: "#444" }}>
            drudge-style racing index • fast links • no fluff
          </div>
        </div>

        {/* Search */}
        <form action="/" method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          {series ? <input type="hidden" name="series" value={series} /> : null}
          {source ? <input type="hidden" name="source" value={source} /> : null}

          <input
            name="q"
            defaultValue={q}
            placeholder="search riders / teams / brands..."
            style={{
              width: 320,
              padding: "10px 12px",
              border: "1px solid #bbb",
              borderRadius: 6,
              fontFamily: "Arial, sans-serif",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              border: "1px solid #999",
              background: "white",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "Arial, sans-serif",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Go
          </button>
        </form>
      </div>

      {/* Filters */}
      <div style={{ marginTop: 18, borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd", padding: "12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            {FILTERS.map((f) => {
              const active = (f.series || "") === (series || "");
              return (
                <Link
                  key={f.label}
                  href={`/${qp({ series: f.series || undefined, q: q || undefined, source: source || undefined })}`}
                  style={{
                    textDecoration: "none",
                    color: "#111",
                    fontWeight: active ? 800 : 600,
                    borderBottom: active ? "2px solid #111" : "2px solid transparent",
                    paddingBottom: 2,
                  }}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#666" }}>
            Quick filters
          </div>
        </div>
      </div>

      {/* Breaking */}
      <section style={{ marginTop: 26, textAlign: "center" }}>
        <div style={{ color: "#b30000", fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: 900 }}>
          BREAKING
        </div>

        {breaking && (
          <div style={{ marginTop: 10 }}>
            <a
              href={breaking.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 30, fontWeight: 800, color: "#111", textDecoration: "none" }}
            >
              {breaking.title}
            </a>
          </div>
        )}
      </section>

      {/* 3 columns */}
      <section style={{ marginTop: 26 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40 }}>
          {[col1, col2, col3].map((col, idx) => (
            <div key={idx}>
              {col.map((p) => (
                <div key={p.id} style={{ marginBottom: 18 }}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800 }}>
                    {p.title}
                  </a>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {p.source} • {p.series}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: 40, borderTop: "1px solid #ddd", paddingTop: 16, fontSize: 12, color: "#555" }}>
        © 2026 MotoCodex • text-first racing index
      </footer>
    </main>
  );
}

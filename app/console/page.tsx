import { supabaseAdmin } from "@/lib/supabaseAdmin";

function fmt(n: any) {
  const x = Number(n ?? 0);
  return Math.round(x * 1000) / 1000;
}

export default async function ConsolePage() {
  const sb = supabaseAdmin;
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: breaking } = await sb
    .from("news_items")
    .select("id,title,source_key,league,importance,credibility,momentum,published_at,url")
    .eq("is_active", true)
    .eq("is_breaking", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: today } = await sb
    .from("news_items")
    .select("id,title,source_key,league,importance,credibility,momentum,created_at,url")
    .eq("is_active", true)
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: week } = await sb
    .from("news_items")
    .select("id,title,source_key,league,importance,credibility,momentum,created_at,url")
    .eq("is_active", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);

  const { data: clusters } = await sb
    .from("story_clusters")
    .select("id,title,league,importance,credibility,momentum,last_seen_at")
    .eq("is_active", true)
    .order("momentum", { ascending: false })
    .limit(25);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100 }}>
      <h1>MotoCodex Console</h1>
      <p>
        Workflow: ingest → score → cluster → daily brief.
      </p>

      <Section title="Breaking">
        <ItemList items={breaking || []} />
      </Section>

      <Section title="Today">
        <ItemList items={today || []} />
      </Section>

      <Section title="Week">
        <ItemList items={week || []} />
      </Section>

      <Section title="Story Clusters">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>League</th>
              <th style={th}>Imp</th>
              <th style={th}>Cred</th>
              <th style={th}>Mom</th>
              <th style={th}>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {(clusters || []).map((c: any) => (
              <tr key={c.id}>
                <td style={td}>{c.title}</td>
                <td style={td}>{c.league || ""}</td>
                <td style={td}>{fmt(c.importance)}</td>
                <td style={td}>{fmt(c.credibility)}</td>
                <td style={td}>{fmt(c.momentum)}</td>
                <td style={td}>{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </main>
  );
}

function Section({ title, children }: any) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  );
}

function ItemList({ items }: any) {
  return (
    <ul style={{ paddingLeft: 18 }}>
      {items.map((x: any) => (
        <li key={x.id} style={{ marginBottom: 8 }}>
          <b>{x.title}</b>{" "}
          <small>
            [{x.source_key}] [{x.league || "General"}] imp:{fmt(x.importance)} cred:{fmt(x.credibility)} mom:{fmt(x.momentum)}
          </small>
          {x.url ? <div><a href={x.url}>open</a></div> : null}
        </li>
      ))}
    </ul>
  );
}

const th: any = { textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 };
const td: any = { borderBottom: "1px solid #eee", padding: 8, verticalAlign: "top" };

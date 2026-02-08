import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Home() {
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>MotoCodex</h1>
        <div style={{ fontSize: 12 }}>
          SX&nbsp;&nbsp;MX&nbsp;&nbsp;SMX&nbsp;&nbsp;WSX&nbsp;&nbsp;WMX&nbsp;&nbsp;MXGP&nbsp;&nbsp;Amateur
        </div>
      </header>

      <hr />

      <ul style={{ lineHeight: 1.6 }}>
        {posts && posts.length > 0 ? (
          posts.map((post) => (
            <li key={post.id}>
              <a href={post.url} target="_blank" rel="noreferrer">
                {post.title}
              </a>{" "}
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                ({post.series || "General"} — {post.source || "Unknown"})
              </span>
            </li>
          ))
        ) : (
          <li>No posts yet</li>
        )}
      </ul>

      <footer style={{ marginTop: 32, fontSize: 12, opacity: 0.7 }}>
        <hr />
        © {new Date().getFullYear()} MotoCodex • text-first racing index
      </footer>
    </main>
  );
}

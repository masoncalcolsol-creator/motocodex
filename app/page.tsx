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
      <header style={{ textAlign: "center", paddingBottom: "16px" }}>
        <h1 style={{ fontSize: "36px", margin: "0" }}>MotoCodex</h1>
      </header>

      <hr />

      <ul style={{ lineHeight: 1.6, listStyleType: "none", padding: 0 }}>
        {posts && posts.length > 0 ? (
          posts.map((post) => (
            <li key={post.id} style={{ marginBottom: "12px" }}>
              <a href={post.url} target="_blank" rel="noreferrer" style={{ fontSize: "18px", color: "#000", textDecoration: "none" }}>
                {post.title}
              </a>
              <br />
              <span style={{ fontSize: "12px", color: "#666" }}>
                ({post.series || "General"} — {post.source || "Unknown"})
              </span>
            </li>
          ))
        ) : (
          <li>No posts yet</li>
        )}
      </ul>

      <footer style={{ marginTop: 32, fontSize: 12, textAlign: "center", opacity: 0.7 }}>
        <hr />
        © {new Date().getFullYear()} MotoCodex • text-first racing index
      </footer>
    </main>
  );
}

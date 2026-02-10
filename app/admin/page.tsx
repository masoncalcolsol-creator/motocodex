// app/admin/page.tsx
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Post = {
  id: string;
  title: string;
  series: string;
  source: string;
  is_breaking: boolean;
  is_pinned: boolean;
  pin_rank: number;
  is_hidden: boolean;
};

export default function AdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from("posts")
        .select("id,title,series,source,is_breaking,is_pinned,pin_rank,is_hidden")
        .order("is_pinned", { ascending: false })
        .order("pin_rank", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }
      setPosts(data || []);
      setLoading(false);
    }

    fetchPosts();
  }, []);

  const updatePost = async (id: string, updates: Partial<Post>) => {
    const { error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }
    setPosts((prev) => prev.map((post) => (post.id === id ? { ...post, ...updates } : post)));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>MotoCodex Admin</h1>

      <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Series</th>
            <th>Source</th>
            <th>Breaking</th>
            <th>Pinned</th>
            <th>Hide</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td>{post.title}</td>
              <td>{post.series}</td>
              <td>{post.source}</td>
              <td>{post.is_breaking ? "Yes" : "No"}</td>
              <td>{post.is_pinned ? "Yes" : "No"}</td>
              <td>{post.is_hidden ? "Yes" : "No"}</td>
              <td>
                <button
                  onClick={() => updatePost(post.id, { is_breaking: !post.is_breaking })}
                  style={{ marginRight: 8 }}
                >
                  Toggle Breaking
                </button>
                <button
                  onClick={() => updatePost(post.id, { is_pinned: !post.is_pinned, pin_rank: post.is_pinned ? 100 : 1 })}
                  style={{ marginRight: 8 }}
                >
                  Toggle Pin
                </button>
                <button onClick={() => updatePost(post.id, { is_hidden: !post.is_hidden })}>
                  Toggle Hide
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

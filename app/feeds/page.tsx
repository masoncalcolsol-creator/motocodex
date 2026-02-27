export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FeedsPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>MotoFEEDS</h1>
      <div style={{ marginTop: 12, padding: 12, border: "3px solid red", fontWeight: 900 }}>
        IG_DEBUG_MARKER_123
      </div>
      <p style={{ marginTop: 12 }}>
        If you do not see the red box + marker above on /feeds, then /feeds is NOT using app/feeds/page.tsx.
      </p>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FeedsPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>MotoFEEDS</h1>
      <div style={{ marginTop: 12, padding: 12, border: "3px solid lime", fontWeight: 900 }}>
        MOTOFEEDS_REALPAGE_V1
      </div>
      <p style={{ marginTop: 12 }}>
        If you see this, deployments are updating /feeds correctly.
      </p>
    </main>
  );
}

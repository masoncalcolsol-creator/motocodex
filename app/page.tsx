export default function Home() {
  return (
    <main style={{ maxWidth: 980, margin: "32px auto", padding: "0 16px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0, letterSpacing: 0.5 }}>MotoCodex</h1>
        <div style={{ fontSize: 12 }}>
          <a href="#" style={{ marginRight: 10 }}>SX</a>
          <a href="#" style={{ marginRight: 10 }}>MX</a>
          <a href="#" style={{ marginRight: 10 }}>SMX</a>
          <a href="#" style={{ marginRight: 10 }}>WSX</a>
          <a href="#" style={{ marginRight: 10 }}>WMX</a>
          <a href="#" style={{ marginRight: 10 }}>MXGP</a>
          <a href="#">Amateur</a>
        </div>
      </header>

      <hr style={{ margin: "12px 0 18px" }} />

      <section>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Top</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
          <li><a href="#" style={{ textDecoration: "none" }}>BREAKING: Example headline placeholder</a></li>
          <li><a href="#" style={{ textDecoration: "none" }}>Team/Rider rumor mill – example link</a></li>
          <li><a href="#" style={{ textDecoration: "none" }}>Race recap: example link</a></li>
        </ul>
      </section>

      <hr style={{ margin: "18px 0" }} />

      <section>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>More</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
          <li><a href="#" style={{ textDecoration: "none" }}>YouTube show: example link</a></li>
          <li><a href="#" style={{ textDecoration: "none" }}>Podcast clip: example link</a></li>
          <li><a href="#" style={{ textDecoration: "none" }}>Industry press release: example link</a></li>
        </ul>
      </section>

      <footer style={{ marginTop: 28, fontSize: 12, opacity: 0.8 }}>
        <hr style={{ margin: "18px 0 10px" }} />
        <div>© {new Date().getFullYear()} MotoCodex • text-first racing index</div>
      </footer>
    </main>
  );
}

import { SPORTS } from "../../lib/sports-beta";

export default function SportsHub() {
  return (
    <main style={{minHeight:"100vh",padding:"40px 18px",background:"radial-gradient(circle at top,#17202c,#05070a 48%)",color:"#fff"}}>
      <section style={{width:"min(1000px,100%)",margin:"0 auto"}}>
        <div style={{fontSize:10,fontWeight:900,letterSpacing:".16em",textTransform:"uppercase",color:"#d9ff35"}}>NULLWORKS Sports Intelligence Beta</div>
        <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(46px,9vw,92px)",lineHeight:.92,letterSpacing:"-.055em",margin:"18px 0"}}>Six sports.<br/>One mobile command layer.</h1>
        <p style={{maxWidth:760,color:"#aaa39a",fontSize:17,lineHeight:1.65}}>Open a sport to beta its CODEX, FEEDS, search, source registry, public discovery wire, and installable mobile surface.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10,marginTop:28}}>
          {Object.values(SPORTS).map((sport) => <a key={sport.slug} href={`/${sport.slug}`} style={{padding:22,border:"1px solid rgba(255,255,255,.1)",borderRadius:18,background:"rgba(255,255,255,.035)",textDecoration:"none"}}>
            <small style={{color:sport.accent,fontWeight:900,letterSpacing:".12em"}}>{sport.short}</small>
            <h2 style={{fontFamily:"Georgia,serif",fontSize:28,margin:"10px 0 8px"}}>{sport.codex}</h2>
            <p style={{margin:0,color:"#8e877f",lineHeight:1.5,fontSize:13}}>{sport.league}</p>
          </a>)}
        </div>
      </section>
    </main>
  );
}

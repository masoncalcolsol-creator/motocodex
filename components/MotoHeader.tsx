import Link from "next/link";
import styles from "./MotoHeader.module.css";

const links = [
  { href: "/", label: "MotoCODEX", sub: "News intelligence" },
  { href: "/feeds", label: "MotoFEEDS", sub: "Social signal" },
  { href: "/motopedia", label: "MOTOPEDIA", sub: "Historical memory" },
];

export default function MotoHeader({ active }: { active: "codex" | "feeds" | "pedia" }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <div className={styles.mark}>MC</div>
        <div>
          <span>MotoINTELLIGENCE</span>
          <strong>MotoCODEX Network</strong>
        </div>
      </Link>

      <nav className={styles.nav} aria-label="MotoINTELLIGENCE products">
        {links.map((link) => {
          const key = link.href === "/" ? "codex" : link.href === "/feeds" ? "feeds" : "pedia";
          return (
            <Link key={link.href} href={link.href} className={active === key ? styles.active : undefined}>
              <strong>{link.label}</strong>
              <span>{link.sub}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.status}>
        <i />
        Live system
      </div>
    </header>
  );
}

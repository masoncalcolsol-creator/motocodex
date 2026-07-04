import Link from "next/link";
import MotoHeader from "@/components/MotoHeader";
import {
  coverageBySeries,
  filterMotopediaDocuments,
  getMotopediaIndex,
} from "@/lib/motopedia";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  q?: string;
  series?: string;
  year?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function MotopediaPage({ searchParams }: { searchParams: SearchParams }) {
  const library = getMotopediaIndex();
  const query = String(searchParams?.q ?? "").trim();
  const series = String(searchParams?.series ?? "all").trim().toLowerCase();
  const year = String(searchParams?.year ?? "all").trim();
  const documents = filterMotopediaDocuments(library.documents, { query, series, year });
  const coverage = coverageBySeries(library);
  const years = Array.from(
    new Set(library.documents.map((document) => document.year).filter((value): value is number => typeof value === "number")),
  ).sort((left, right) => right - left);
  const riders = new Set(
    library.facts
      .filter((fact) => fact.entityType === "rider" && fact.entityName)
      .map((fact) => fact.entityName),
  );
  const latest = [...library.documents]
    .sort((left, right) => new Date(right.fetchedAt).getTime() - new Date(left.fetchedAt).getTime())
    .slice(0, 8);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <MotoHeader active="pedia" />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>MOTO HISTORY / RESULTS / STANDINGS / RIDERS / PROVENANCE</div>
            <h1>MOTOPEDIA</h1>
            <p>
              The historical memory layer for MotoINTELLIGENCE: source-linked seasons, rounds, classes, riders, entries, results, standings snapshots, and the exact provenance behind every retained fact.
            </p>
            <form action="/motopedia" className={styles.searchForm}>
              {series !== "all" ? <input type="hidden" name="series" value={series} /> : null}
              {year !== "all" ? <input type="hidden" name="year" value={year} /> : null}
              <input name="q" defaultValue={query} placeholder="Search riders, events, seasons, classes, sources…" />
              <button type="submit">Search library</button>
            </form>
          </div>

          <div className={styles.dashboard}>
            <div><strong>{library.documents.length}</strong><span>source documents</span></div>
            <div><strong>{library.facts.length}</strong><span>atomic facts</span></div>
            <div><strong>{riders.size}</strong><span>riders indexed</span></div>
            <div><strong>{library.series.length}</strong><span>series lanes</span></div>
            <div className={styles.runCard}>
              <span>Historical backfill</span>
              <strong>{library.run.status.replaceAll("-", " ")}</strong>
              <small>
                {library.run.pagesAccepted} pages accepted · {library.run.factsExtracted} facts · generated {formatDate(library.generatedAt)}
              </small>
            </div>
          </div>
        </section>

        <section className={styles.truthBoundary}>
          <div>
            <span>Library doctrine</span>
            <strong>Facts are stored with the route back to the source.</strong>
          </div>
          <p>
            MOTOPEDIA stores factual race data, table structure, metadata, and provenance—not copied article bodies. Source pages remain authoritative, conflicting records remain visible, and provisional extractions remain provisional until verified.
          </p>
        </section>

        <section className={styles.controls}>
          <div className={styles.seriesRail}>
            <Link href="/motopedia" className={series === "all" ? styles.active : undefined}>All series</Link>
            {library.series.map((item) => (
              <Link
                key={item.key}
                href={`/motopedia?series=${encodeURIComponent(item.key)}${year !== "all" ? `&year=${year}` : ""}`}
                className={series === item.key ? styles.active : undefined}
              >
                {item.discipline}
              </Link>
            ))}
          </div>
          <form action="/motopedia" className={styles.yearForm}>
            {query ? <input type="hidden" name="q" value={query} /> : null}
            {series !== "all" ? <input type="hidden" name="series" value={series} /> : null}
            <select name="year" defaultValue={year}>
              <option value="all">All years</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="submit">Apply year</button>
          </form>
        </section>

        <section className={styles.coverageSection}>
          <div className={styles.sectionHeading}>
            <div><span>01</span><strong>Coverage map</strong></div>
            <small>target range vs ingested evidence</small>
          </div>
          <div className={styles.coverageGrid}>
            {coverage.map((item) => (
              <article key={item.key}>
                <div className={styles.coverageTop}>
                  <span>{item.discipline}</span>
                  <b>{item.targetStartYear}–{item.targetEndYear}</b>
                </div>
                <h2>{item.name}</h2>
                <div className={styles.coverageMetrics}>
                  <div><strong>{item.documentCount}</strong><span>documents</span></div>
                  <div><strong>{item.factCount}</strong><span>facts</span></div>
                  <div><strong>{item.years.length}</strong><span>years found</span></div>
                </div>
                <p>{item.status.replaceAll("-", " ")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.libraryGrid}>
          <div className={styles.documentPanel}>
            <div className={styles.sectionHeading}>
              <div><span>02</span><strong>Historical document index</strong></div>
              <small>{documents.length} matching records</small>
            </div>

            {documents.length ? (
              <div className={styles.documentList}>
                {documents.map((document) => (
                  <a key={document.id} href={document.url} target="_blank" rel="noreferrer">
                    <div>
                      <span>{document.seriesKey ?? "unclassified"} · {document.documentType ?? "source page"}</span>
                      <strong>{document.title}</strong>
                      <small>{document.sourceKey} · {document.year ?? "year unknown"} · fetched {formatDate(document.fetchedAt)}</small>
                    </div>
                    <b>{document.factCount ?? 0} facts</b>
                  </a>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>The historical crawler is armed.</strong>
                <p>
                  No source documents match this view yet. The backfill worker begins with Racer X and its historical vaults, then advances oldest-first while preserving checkpoints and failure receipts.
                </p>
                <Link href="/motopedia">Clear filters</Link>
              </div>
            )}
          </div>

          <aside className={styles.sidePanel}>
            <div className={styles.sectionHeading}>
              <div><span>03</span><strong>Source registry</strong></div>
            </div>
            <div className={styles.sourceList}>
              {library.sources.map((source) => (
                <a key={source.key} href={source.baseUrl} target="_blank" rel="noreferrer">
                  <span>Priority {source.priority}</span>
                  <strong>{source.name}</strong>
                  <small>{source.status.replaceAll("-", " ")}</small>
                </a>
              ))}
            </div>

            <div className={styles.pipelineCard}>
              <span>Ingestion pipeline</span>
              <strong>Discover → fetch → parse → normalize → preserve provenance → rebuild</strong>
              <p>
                Each run works from a persistent checkpoint. Duplicate content is hashed, failed pages remain retryable, and deterministic rebuild logic recreates the library from retained source records.
              </p>
            </div>
          </aside>
        </section>

        {latest.length ? (
          <section className={styles.latestSection}>
            <div className={styles.sectionHeading}>
              <div><span>04</span><strong>Latest ingested evidence</strong></div>
            </div>
            <div>{latest.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer">{document.title}</a>)}</div>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <span>MOTOPEDIA · MotoINTELLIGENCE historical memory</span>
          <strong>Queryable facts. Preserved provenance. Deterministic rebuilds.</strong>
        </footer>
      </div>
    </main>
  );
}

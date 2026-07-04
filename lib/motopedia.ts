import "server-only";

import index from "@/data/motopedia/index.json";
import sx1977Seed from "@/data/motopedia/supplements/1977-sx-seed.json";

export type MotopediaSeries = {
  key: string;
  name: string;
  discipline: string;
  targetStartYear: number;
  targetEndYear: number;
  status: string;
};

export type MotopediaSource = {
  key: string;
  name: string;
  baseUrl: string;
  priority: number;
  status: string;
};

export type MotopediaDocument = {
  id: string;
  sourceKey: string;
  url: string;
  title: string;
  fetchedAt: string;
  publishedAt?: string | null;
  year?: number | null;
  seriesKey?: string | null;
  documentType?: string | null;
  tableCount?: number;
  factCount?: number;
  contentHash?: string;
};

export type MotopediaFact = {
  id: string;
  documentId: string;
  sourceKey: string;
  seriesKey?: string | null;
  year?: number | null;
  entityType: string;
  entityName?: string | null;
  factType: string;
  value: string | number | boolean | null;
  context?: Record<string, unknown>;
  provenanceUrl: string;
  extractedAt: string;
};

export type MotopediaIndex = {
  version: number;
  generatedAt: string;
  run: {
    status: string;
    pagesAttempted: number;
    pagesAccepted: number;
    factsExtracted: number;
    lastError: string | null;
  };
  series: MotopediaSeries[];
  sources: MotopediaSource[];
  documents: MotopediaDocument[];
  facts: MotopediaFact[];
};

type MotopediaSupplement = {
  generatedAt?: string;
  run?: Partial<MotopediaIndex["run"]>;
  documents?: MotopediaDocument[];
  facts?: MotopediaFact[];
};

const supplements = [sx1977Seed as MotopediaSupplement];

function byId<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function getMotopediaIndex(): MotopediaIndex {
  const base = index as MotopediaIndex;
  const documents = byId([
    ...base.documents,
    ...supplements.flatMap((supplement) => supplement.documents ?? []),
  ]);
  const facts = byId([
    ...base.facts,
    ...supplements.flatMap((supplement) => supplement.facts ?? []),
  ]);
  const runTotals = supplements.reduce(
    (totals, supplement) => ({
      pagesAttempted: totals.pagesAttempted + (supplement.run?.pagesAttempted ?? 0),
      pagesAccepted: totals.pagesAccepted + (supplement.run?.pagesAccepted ?? 0),
      factsExtracted: totals.factsExtracted + (supplement.run?.factsExtracted ?? 0),
      lastError: supplement.run?.lastError ?? totals.lastError,
    }),
    {
      pagesAttempted: base.run.pagesAttempted,
      pagesAccepted: base.run.pagesAccepted,
      factsExtracted: base.run.factsExtracted,
      lastError: base.run.lastError,
    },
  );

  return {
    ...base,
    generatedAt: supplements.at(-1)?.generatedAt ?? base.generatedAt,
    run: {
      ...base.run,
      ...runTotals,
      status: base.run.status,
    },
    documents,
    facts,
  };
}

export function filterMotopediaDocuments(
  documents: MotopediaDocument[],
  options: { query?: string; series?: string; year?: string },
): MotopediaDocument[] {
  const query = String(options.query ?? "").trim().toLowerCase();
  const series = String(options.series ?? "all").trim().toLowerCase();
  const year = String(options.year ?? "all").trim();

  return documents.filter((document) => {
    if (series !== "all" && document.seriesKey !== series) return false;
    if (year !== "all" && String(document.year ?? "") !== year) return false;
    if (!query) return true;
    return [document.title, document.url, document.sourceKey, document.documentType ?? "", document.seriesKey ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function coverageBySeries(library: MotopediaIndex) {
  return library.series.map((series) => {
    const documents = library.documents.filter((document) => document.seriesKey === series.key);
    const facts = library.facts.filter((fact) => fact.seriesKey === series.key);
    const years = new Set(documents.map((document) => document.year).filter((year): year is number => typeof year === "number"));
    return {
      ...series,
      documentCount: documents.length,
      factCount: facts.length,
      years: Array.from(years).sort((left, right) => left - right),
    };
  });
}

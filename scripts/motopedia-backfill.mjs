#!/usr/bin/env node

/**
 * MOTOPEDIA historical backfill worker.
 *
 * Purpose:
 * - discover public historical result/standings pages from sitemaps
 * - ingest factual metadata and HTML table rows
 * - preserve provenance URLs and deterministic hashes
 * - advance oldest-first through a persistent checkpoint
 *
 * Boundaries:
 * - no authentication bypass, paywall bypass, or private endpoints
 * - honors basic robots.txt Disallow rules for User-agent: *
 * - rate limited and capped per run
 * - does not retain full article bodies or copyrighted prose
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, "data", "motopedia", "index.json");
const CHECKPOINT_PATH = path.join(ROOT, "data", "motopedia", "checkpoint.json");

const MAX_PAGES = Math.max(1, Number(process.env.MOTOPEDIA_MAX_PAGES || 28));
const MAX_FACTS_PER_PAGE = Math.max(10, Number(process.env.MOTOPEDIA_MAX_FACTS_PER_PAGE || 100));
const DELAY_MS = Math.max(500, Number(process.env.MOTOPEDIA_DELAY_MS || 900));
const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.MOTOPEDIA_TIMEOUT_MS || 18_000));
const USER_AGENT = "MotoPEDIA-Historical-Indexer/1.0 (+https://motocodex.vercel.app/motopedia; factual metadata and result tables only)";

const SEED_URLS = {
  racerx: [
    "https://racerxonline.com/results",
    "https://racerxonline.com/archive",
  ],
  "racerx-vault": [
    "https://vault.racerxonline.com/",
  ],
  "racerx-llvault": [
    "https://llvault.racerxonline.com/",
  ],
  supercrosslive: [
    "https://www.supercrosslive.com/results/",
  ],
  promotocross: [
    "https://promotocross.com/results",
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hash(value, length = 24) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
}

function decodeEntities(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value) {
  return decodeEntities(String(value || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(value, base) {
  try {
    const parsed = new URL(value, base);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function yearFromText(value) {
  const matches = String(value || "").match(/\b(19[5-9]\d|20[0-3]\d)\b/g) || [];
  if (!matches.length) return null;
  return Number(matches[0]);
}

function seriesFromText(value) {
  const text = String(value || "").toLowerCase();
  if (/loretta|amateur national/.test(text)) return "loretta-lynns-amateur-national";
  if (/world supercross|\bwsx\b/.test(text)) return "fim-world-supercross";
  if (/mxgp|mx2|world motocross|grand prix motocross/.test(text)) return "fim-motocross-world-championship";
  if (/supermotocross|\bsmx\b/.test(text)) return "supermotocross";
  if (/pro motocross|ama motocross|\b450mx\b|\b250mx\b|outdoor national/.test(text)) return "ama-pro-motocross";
  if (/supercross|\b450sx\b|\b250sx\b/.test(text)) return "ama-supercross";
  return null;
}

function documentTypeFromText(value) {
  const text = String(value || "").toLowerCase();
  if (/standings|points/.test(text)) return "standings";
  if (/overall.*results|race.*results|results/.test(text)) return "results";
  if (/rider|career|profile/.test(text)) return "rider-profile";
  if (/schedule|calendar/.test(text)) return "schedule";
  if (/champion|history|archive/.test(text)) return "historical-index";
  return "source-page";
}

function candidateScore(url, sourceKey) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return -100;
  }

  const text = `${parsed.hostname} ${parsed.pathname} ${parsed.search}`.toLowerCase();
  let score = 0;

  if (sourceKey.includes("vault") || parsed.hostname.includes("vault")) score += 45;
  if (/results?|standings?|points?|rider|race-results|career|season|champion|archive|history/.test(text)) score += 38;
  if (/supercross|motocross|smx|mxgp|wsx|loretta|arenacross/.test(text)) score += 16;
  if (/\b(19[5-9]\d|20[0-3]\d)\b/.test(text)) score += 15;
  if (/news|podcast|video|photo|press-release|advert|shop|subscribe/.test(text)) score -= 25;
  if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip)$/i.test(parsed.pathname)) score -= 100;
  return score;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fetchText(url, { accept = "text/html,application/xhtml+xml,application/xml,text/xml,*/*", retries = 2 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept,
        },
        redirect: "follow",
        signal: controller.signal,
      });
      const body = await response.text();
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return {
        url: response.url || url,
        body,
        contentType: response.headers.get("content-type") || "",
        lastModified: response.headers.get("last-modified"),
      };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < retries) await sleep(700 * (attempt + 1));
    }
  }

  throw lastError || new Error("Unknown fetch failure");
}

function parseRobots(value) {
  const rules = [];
  let applies = false;

  for (const rawLine of String(value || "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const entry = rest.join(":").trim();

    if (key === "user-agent") applies = entry === "*";
    if (key === "disallow" && applies && entry) rules.push(entry);
  }

  return rules;
}

async function loadRobots(baseUrl) {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const result = await fetchText(robotsUrl, { accept: "text/plain,*/*", retries: 0 });
    return parseRobots(result.body);
  } catch {
    return [];
  }
}

function robotsAllows(url, rules) {
  const pathname = new URL(url).pathname;
  return !rules.some((rule) => rule !== "/" && pathname.startsWith(rule)) && !rules.includes("/");
}

function parseSitemapLocations(xml, baseUrl) {
  return Array.from(String(xml || "").matchAll(/<loc>([\s\S]*?)<\/loc>/gi))
    .map((match) => safeUrl(decodeEntities(match[1].trim()), baseUrl))
    .filter(Boolean);
}

async function discoverSourceUrls(source, checkpoint) {
  const base = new URL(source.baseUrl);
  const roots = [
    new URL("/sitemap.xml", base).toString(),
    new URL("/sitemap_index.xml", base).toString(),
    new URL("/sitemap-index.xml", base).toString(),
  ];
  const sitemapQueue = [...new Set(roots)];
  const visitedSitemaps = new Set();
  const discovered = new Set(SEED_URLS[source.key] || []);

  while (sitemapQueue.length && visitedSitemaps.size < 50 && discovered.size < 35_000) {
    const sitemapUrl = sitemapQueue.shift();
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);

    try {
      const result = await fetchText(sitemapUrl, { accept: "application/xml,text/xml,*/*", retries: 1 });
      const locations = parseSitemapLocations(result.body, result.url);

      for (const location of locations) {
        if (/\.xml($|\?)/i.test(location) || /sitemap/i.test(new URL(location).pathname)) {
          if (!visitedSitemaps.has(location)) sitemapQueue.push(location);
        } else if (new URL(location).hostname === base.hostname && candidateScore(location, source.key) >= 28) {
          discovered.add(location);
        }
      }
    } catch (error) {
      checkpoint.sitemaps[sitemapUrl] = {
        ok: false,
        checkedAt: new Date().toISOString(),
        error: String(error?.message || error),
      };
    }

    await sleep(Math.min(DELAY_MS, 1_000));
  }

  checkpoint.sitemaps[source.key] = {
    ok: discovered.size > 0,
    checkedAt: new Date().toISOString(),
    sitemapCount: visitedSitemaps.size,
    candidateCount: discovered.size,
  };

  return Array.from(discovered);
}

function extractMeta(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1]).trim();
    }
  }
  return null;
}

function extractTitle(html) {
  return (
    extractMeta(html, ["og:title", "twitter:title"]) ||
    stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ||
    "Untitled historical source"
  ).slice(0, 300);
}

function extractPublishedAt(html, lastModified) {
  const raw = extractMeta(html, [
    "article:published_time",
    "datePublished",
    "publish-date",
    "date",
  ]) || lastModified;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseTables(html) {
  const tables = [];
  const blocks = String(html || "").match(/<table\b[\s\S]*?<\/table>/gi) || [];

  for (const block of blocks.slice(0, 20)) {
    const rows = [];
    const rowBlocks = block.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

    for (const rowBlock of rowBlocks.slice(0, 250)) {
      const cells = Array.from(rowBlock.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi))
        .map((match) => stripHtml(match[2]).slice(0, 240))
        .filter((value) => value.length > 0);
      if (cells.length) rows.push(cells);
    }

    if (rows.length) tables.push(rows);
  }

  return tables;
}

function normalizeHeader(value, index) {
  const header = stripHtml(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return header || `column_${index + 1}`;
}

function inferEntityName(record) {
  const candidates = [
    "rider",
    "rider_name",
    "name",
    "competitor",
    "athlete",
    "driver",
  ];
  for (const key of candidates) {
    const value = record[key];
    if (value && !/^\d+$/.test(String(value))) return String(value).slice(0, 160);
  }
  return null;
}

function factsFromTables({ tables, documentId, sourceKey, url, title, seriesKey, year, extractedAt }) {
  const facts = [];

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const rows = tables[tableIndex];
    if (!rows.length) continue;

    const firstRow = rows[0];
    const looksLikeHeader = firstRow.some((cell) => /rider|name|place|position|points|class|moto|finish|number|rank|total|round/i.test(cell));
    const headers = (looksLikeHeader ? firstRow : firstRow.map((_, index) => `column_${index + 1}`))
      .map(normalizeHeader);
    const bodyRows = looksLikeHeader ? rows.slice(1) : rows;

    for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex += 1) {
      if (facts.length >= MAX_FACTS_PER_PAGE) return facts;
      const row = bodyRows[rowIndex];
      const record = {};
      row.slice(0, 24).forEach((value, index) => {
        record[headers[index] || `column_${index + 1}`] = value;
      });

      const compact = JSON.stringify(record);
      if (compact === "{}" || compact.length < 4) continue;
      const entityName = inferEntityName(record);
      const factId = hash(`${documentId}:${tableIndex}:${rowIndex}:${compact}`, 28);

      facts.push({
        id: factId,
        documentId,
        sourceKey,
        seriesKey,
        year,
        entityType: entityName ? "rider" : "result-row",
        entityName,
        factType: documentTypeFromText(`${title} ${url}`) === "standings" ? "standings-row" : "result-row",
        value: compact,
        context: {
          tableIndex,
          rowIndex,
          headers,
        },
        provenanceUrl: url,
        extractedAt,
      });
    }
  }

  return facts;
}

async function ingestPage(queueItem, source, robots) {
  if (!robotsAllows(queueItem.url, robots)) {
    throw new Error("Blocked by robots.txt");
  }

  const fetched = await fetchText(queueItem.url, { accept: "text/html,application/xhtml+xml,*/*", retries: 1 });
  if (!/html|xhtml/i.test(fetched.contentType) && !/<html/i.test(fetched.body)) {
    throw new Error(`Unsupported content type: ${fetched.contentType || "unknown"}`);
  }

  const title = extractTitle(fetched.body);
  const publishedAt = extractPublishedAt(fetched.body, fetched.lastModified);
  const year = yearFromText(`${queueItem.url} ${title} ${publishedAt || ""}`);
  const seriesKey = seriesFromText(`${queueItem.url} ${title}`);
  const documentType = documentTypeFromText(`${queueItem.url} ${title}`);
  const tables = parseTables(fetched.body);
  const contentHash = hash(fetched.body, 40);
  const fetchedAt = new Date().toISOString();
  const canonical = safeUrl(extractMeta(fetched.body, ["og:url"]) || fetched.url, fetched.url) || fetched.url;
  const documentId = hash(canonical, 28);

  const facts = factsFromTables({
    tables,
    documentId,
    sourceKey: source.key,
    url: canonical,
    title,
    seriesKey,
    year,
    extractedAt: fetchedAt,
  });

  const accepted =
    tables.length > 0 ||
    documentType !== "source-page" ||
    candidateScore(canonical, source.key) >= 48;

  if (!accepted) throw new Error("Page did not contain durable historical result metadata");

  return {
    document: {
      id: documentId,
      sourceKey: source.key,
      url: canonical,
      title,
      fetchedAt,
      publishedAt,
      year,
      seriesKey,
      documentType,
      tableCount: tables.length,
      factCount: facts.length,
      contentHash,
    },
    facts,
  };
}

async function syncSupabase(documents, facts) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole || !documents.length) return { attempted: false };

  const headers = {
    apikey: serviceRole,
    authorization: `Bearer ${serviceRole}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=minimal",
  };

  const documentRows = documents.map((document) => ({
    id: document.id,
    source_key: document.sourceKey,
    url: document.url,
    title: document.title,
    fetched_at: document.fetchedAt,
    published_at: document.publishedAt,
    year: document.year,
    series_key: document.seriesKey,
    document_type: document.documentType,
    table_count: document.tableCount,
    fact_count: document.factCount,
    content_hash: document.contentHash,
  }));

  const docResponse = await fetch(`${supabaseUrl}/rest/v1/motopedia_documents?on_conflict=id`, {
    method: "POST",
    headers,
    body: JSON.stringify(documentRows),
  });
  if (!docResponse.ok) throw new Error(`Supabase documents sync failed: ${docResponse.status} ${await docResponse.text()}`);

  if (facts.length) {
    const factRows = facts.map((fact) => ({
      id: fact.id,
      document_id: fact.documentId,
      source_key: fact.sourceKey,
      series_key: fact.seriesKey,
      year: fact.year,
      entity_type: fact.entityType,
      entity_name: fact.entityName,
      fact_type: fact.factType,
      value_text: String(fact.value ?? ""),
      context: fact.context || {},
      provenance_url: fact.provenanceUrl,
      extracted_at: fact.extractedAt,
    }));

    for (let index = 0; index < factRows.length; index += 500) {
      const response = await fetch(`${supabaseUrl}/rest/v1/motopedia_facts?on_conflict=id`, {
        method: "POST",
        headers,
        body: JSON.stringify(factRows.slice(index, index + 500)),
      });
      if (!response.ok) throw new Error(`Supabase facts sync failed: ${response.status} ${await response.text()}`);
    }
  }

  return { attempted: true, documentCount: documentRows.length, factCount: facts.length };
}

async function main() {
  const library = await readJson(INDEX_PATH);
  const checkpoint = await readJson(CHECKPOINT_PATH);
  const startedAt = new Date().toISOString();
  const newlyDiscovered = [];

  library.run = {
    status: "discovering",
    pagesAttempted: 0,
    pagesAccepted: 0,
    factsExtracted: 0,
    lastError: null,
  };

  for (const source of library.sources.sort((left, right) => left.priority - right.priority)) {
    const lastDiscovery = checkpoint.sitemaps?.[source.key]?.checkedAt;
    const stale = !lastDiscovery || Date.now() - new Date(lastDiscovery).getTime() > 5 * 24 * 60 * 60 * 1_000;
    const queuedForSource = checkpoint.queue.filter((item) => item.sourceKey === source.key && !checkpoint.processed[item.url]).length;

    if (stale || queuedForSource < 12) {
      const discovered = await discoverSourceUrls(source, checkpoint);
      for (const url of discovered) {
        if (checkpoint.processed[url] || checkpoint.queue.some((item) => item.url === url)) continue;
        const item = {
          url,
          sourceKey: source.key,
          discoveredAt: startedAt,
          yearHint: yearFromText(url),
          score: candidateScore(url, source.key),
        };
        checkpoint.queue.push(item);
        newlyDiscovered.push(item);
      }
    }
  }

  checkpoint.queue.sort((left, right) => {
    const leftYear = left.yearHint ?? 9999;
    const rightYear = right.yearHint ?? 9999;
    return leftYear - rightYear || right.score - left.score || left.url.localeCompare(right.url);
  });

  const sourceMap = new Map(library.sources.map((source) => [source.key, source]));
  const robotsMap = new Map();
  const acceptedDocuments = [];
  const acceptedFacts = [];
  const remaining = [];

  for (const item of checkpoint.queue) {
    if (library.run.pagesAttempted >= MAX_PAGES || checkpoint.processed[item.url]) {
      if (!checkpoint.processed[item.url]) remaining.push(item);
      continue;
    }

    const source = sourceMap.get(item.sourceKey);
    if (!source) continue;

    if (!robotsMap.has(source.key)) {
      robotsMap.set(source.key, await loadRobots(source.baseUrl));
    }

    library.run.pagesAttempted += 1;

    try {
      const { document, facts } = await ingestPage(item, source, robotsMap.get(source.key));
      const existingDocument = library.documents.find((candidate) => candidate.id === document.id);

      if (!existingDocument || existingDocument.contentHash !== document.contentHash) {
        library.documents = library.documents.filter((candidate) => candidate.id !== document.id);
        library.documents.push(document);
        library.facts = library.facts.filter((fact) => fact.documentId !== document.id);
        library.facts.push(...facts);
        acceptedDocuments.push(document);
        acceptedFacts.push(...facts);
      }

      checkpoint.processed[item.url] = {
        processedAt: new Date().toISOString(),
        documentId: document.id,
        contentHash: document.contentHash,
        factCount: facts.length,
      };
      delete checkpoint.failed[item.url];
      library.run.pagesAccepted += 1;
      library.run.factsExtracted += facts.length;
    } catch (error) {
      const previous = checkpoint.failed[item.url] || { attempts: 0 };
      checkpoint.failed[item.url] = {
        attempts: previous.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        error: String(error?.message || error).slice(0, 500),
      };

      if (checkpoint.failed[item.url].attempts < 4) remaining.push(item);
    }

    await sleep(DELAY_MS);
  }

  checkpoint.queue = remaining;
  checkpoint.updatedAt = new Date().toISOString();
  checkpoint.cursor = Number(checkpoint.cursor || 0) + library.run.pagesAttempted;

  library.documents.sort((left, right) => {
    const leftYear = left.year ?? 9999;
    const rightYear = right.year ?? 9999;
    return leftYear - rightYear || left.title.localeCompare(right.title);
  });
  library.facts.sort((left, right) => left.documentId.localeCompare(right.documentId) || left.id.localeCompare(right.id));
  library.generatedAt = new Date().toISOString();
  library.run.status = library.run.pagesAttempted ? "backfill-active" : "queue-empty";

  try {
    const sync = await syncSupabase(acceptedDocuments, acceptedFacts);
    library.run.supabaseSync = sync;
  } catch (error) {
    library.run.supabaseSync = { attempted: true, error: String(error?.message || error).slice(0, 500) };
  }

  await writeJson(INDEX_PATH, library);
  await writeJson(CHECKPOINT_PATH, checkpoint);

  console.log(JSON.stringify({
    ok: true,
    startedAt,
    finishedAt: library.generatedAt,
    newlyDiscovered: newlyDiscovered.length,
    attempted: library.run.pagesAttempted,
    accepted: library.run.pagesAccepted,
    facts: library.run.factsExtracted,
    totalDocuments: library.documents.length,
    totalFacts: library.facts.length,
    remainingQueue: checkpoint.queue.length,
    failuresTracked: Object.keys(checkpoint.failed).length,
  }, null, 2));
}

main().catch(async (error) => {
  try {
    const library = await readJson(INDEX_PATH);
    library.generatedAt = new Date().toISOString();
    library.run = {
      ...(library.run || {}),
      status: "failed",
      lastError: String(error?.stack || error?.message || error).slice(0, 2_000),
    };
    await writeJson(INDEX_PATH, library);
  } catch {
    // Preserve the original failure below.
  }

  console.error(error);
  process.exitCode = 1;
});

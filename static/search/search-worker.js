import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";
import { escapeLike, isUsefulToken, normalizeText, sqlString, unique } from "./search-utils.js";

const SEARCH_DB_URL = "/search/index.duckdb";
const SEARCH_DB_NAME = "search.duckdb";
const SEARCH_DB_CACHE_DB = "search-db-cache";
const SEARCH_DB_CACHE_STORE = "files";
const SEARCH_DB_CACHE_VERSION = 1;
const SEARCH_DB_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 30;
const RESULT_COLUMNS = ["title", "url", "date", "reading_time", "description", "tags", "raw_text"];
const querySegmenter = "Segmenter" in Intl
  ? new Intl.Segmenter("ja", { granularity: "word" })
  : null;

let db;
let conn;

self.onmessage = async (event) => {
  const { id, type, query } = event.data;

  try {
    if (type === "init") {
      const count = await init();
      postMessage({ id, type: "ready", count });
      return;
    }

    if (type === "search") {
      const results = await search(query);
      postMessage({ id, type: "results", results });
    }
  } catch (error) {
    postMessage({ id, type: "error", message: error.message || String(error) });
  }
};

async function init() {
  db = await initDuckDB();
  await openSearchDatabase(db);
  conn = await db.connect();
  await loadFts();
  const count = await conn.query("SELECT count(*)::INTEGER AS count FROM posts");
  return Number(count.toArray()[0]?.count || 0);
}

async function initDuckDB() {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerSource = `importScripts("${bundle.mainWorker}");`;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const instance = new duckdb.AsyncDuckDB(logger, worker);
  await instance.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return instance;
}

async function openSearchDatabase(instance) {
  const databaseUrl = new URL(SEARCH_DB_URL, self.location.origin).href;
  const databaseBuffer = await loadSearchDatabase(databaseUrl);
  await instance.registerFileBuffer(SEARCH_DB_NAME, new Uint8Array(databaseBuffer));
  await instance.open({
    path: SEARCH_DB_NAME,
    accessMode: duckdb.DuckDBAccessMode.READ_ONLY,
  });
}

async function loadSearchDatabase(databaseUrl) {
  const cached = await readCachedDatabase(databaseUrl);
  if (cached && isUsableCachedDatabase(cached) && !isExpiredCachedDatabase(cached)) {
    return cached.buffer;
  }

  const metadata = await fetchDatabaseMetadata(databaseUrl);

  if (cached && isFreshCachedDatabase(cached, metadata)) {
    return cached.buffer;
  }

  try {
    return await fetchAndCacheDatabase(databaseUrl, metadata);
  } catch (error) {
    if (cached) return cached.buffer;
    throw error;
  }
}

async function fetchDatabaseMetadata(databaseUrl) {
  try {
    const response = await fetch(databaseUrl, { method: "HEAD", cache: "no-cache" });
    if (!response.ok) return null;
    return responseMetadata(response);
  } catch {
    return null;
  }
}

async function fetchAndCacheDatabase(databaseUrl, metadata) {
  const response = await fetch(databaseUrl, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to fetch search database: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const record = {
    key: databaseUrl,
    version: SEARCH_DB_CACHE_VERSION,
    cachedAt: Date.now(),
    buffer,
    ...metadata,
    ...responseMetadata(response),
  };
  await writeCachedDatabase(record);
  return buffer;
}

function responseMetadata(response) {
  return {
    etag: response.headers.get("etag") || "",
    lastModified: response.headers.get("last-modified") || "",
    contentLength: response.headers.get("content-length") || "",
  };
}

function isFreshCachedDatabase(record, metadata) {
  if (!isUsableCachedDatabase(record)) return false;
  if (!metadata) return true;
  if (metadata.etag && record.etag) return metadata.etag === record.etag;
  if (metadata.lastModified && record.lastModified) return metadata.lastModified === record.lastModified;
  if (metadata.contentLength && record.contentLength) return metadata.contentLength === record.contentLength;
  return true;
}

function isUsableCachedDatabase(record) {
  return record.version === SEARCH_DB_CACHE_VERSION && record.buffer instanceof ArrayBuffer;
}

function isExpiredCachedDatabase(record) {
  return Date.now() - Number(record.cachedAt || 0) > SEARCH_DB_CACHE_TTL_MS;
}

async function readCachedDatabase(databaseUrl) {
  try {
    const cache = await openCacheDatabase();
    const record = await requestToPromise(
      cache.transaction(SEARCH_DB_CACHE_STORE, "readonly").objectStore(SEARCH_DB_CACHE_STORE).get(databaseUrl),
    );
    cache.close();
    return record || null;
  } catch {
    return null;
  }
}

async function writeCachedDatabase(record) {
  try {
    const cache = await openCacheDatabase();
    const transaction = cache.transaction(SEARCH_DB_CACHE_STORE, "readwrite");
    transaction.objectStore(SEARCH_DB_CACHE_STORE).put(record);
    await transactionToPromise(transaction);
    cache.close();
  } catch {
    // IndexedDB is only an optimization. Search still works with the fetched buffer.
  }
}

function openCacheDatabase() {
  const request = indexedDB.open(SEARCH_DB_CACHE_DB, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(SEARCH_DB_CACHE_STORE, { keyPath: "key" });
  };
  return requestToPromise(request);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function loadFts() {
  try {
    await conn.query("INSTALL fts");
    await conn.query("LOAD fts");
  } catch (error) {
    throw new Error(`DuckDB FTS is unavailable: ${error.message || String(error)}`);
  }
}

async function search(rawQuery) {
  const raw = normalizeText(rawQuery);
  const queryTokens = tokenizeQuery(raw);
  if (!queryTokens.length) return { queryTokens, rows: [] };

  const query = buildSearchQuery(raw, queryTokens);
  const rows = await conn.query(`
    WITH ranked AS (
      SELECT ${searchSelectSql(query, `fts_main_posts.match_bm25(row_id, ${query.tokenQuery}) AS bm25`)}
      FROM posts
    )
    SELECT *
    FROM ranked
    WHERE bm25 IS NOT NULL
      OR phrase_match = 1
      OR token_matches > 0
    ORDER BY
      (token_matches = ${queryTokens.length}) DESC,
      phrase_match DESC,
      bm25 DESC NULLS LAST,
      token_matches DESC,
      date DESC
    LIMIT ${MAX_RESULTS}
  `);

  return { queryTokens, rows: rows.toArray().map(toPlainResult) };
}

function toPlainResult(row) {
  return {
    title: String(row.title || ""),
    url: String(row.url || ""),
    date: String(row.date || ""),
    reading_time: Number(row.reading_time || 0),
    description: String(row.description || ""),
    tags: normalizeTags(row.tags),
    raw_text: String(row.raw_text || ""),
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (tags && typeof tags.toArray === "function") return tags.toArray();
  return [];
}

function tokenizeQuery(query) {
  const normalized = normalizeText(query);
  const words = querySegmenter
    ? [...querySegmenter.segment(normalized)].filter((part) => part.isWordLike).map((part) => part.segment)
    : normalized.split(/\s+/);

  return unique(
    [normalized, ...words, ...(normalized.match(/[a-z0-9][a-z0-9._+#:-]*/g) || [])]
      .flatMap((term) => normalizeText(term).split(/\s+/))
      .filter(isUsefulToken),
  );
}

function buildSearchQuery(rawQuery, queryTokens) {
  return {
    phrase: sqlString(rawQuery),
    tokenQuery: sqlString(queryTokens.join(" ")),
    tokenScore: tokenScoreSql(queryTokens),
  };
}

function searchSelectSql(query, bm25Sql) {
  return [
    ...RESULT_COLUMNS,
    `${query.tokenScore} AS token_matches`,
    `CASE WHEN raw_text LIKE '%' || ${query.phrase} || '%' THEN 1 ELSE 0 END AS phrase_match`,
    bm25Sql,
  ].join(",\n        ");
}

function tokenScoreSql(tokens) {
  return tokens
    .map((token) => `CASE WHEN token_blob LIKE '% ${escapeLike(token)} %' ESCAPE '\\' THEN 1 ELSE 0 END`)
    .join(" + ");
}

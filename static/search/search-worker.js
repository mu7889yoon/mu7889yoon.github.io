import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";

const SEARCH_DB_URL = "/search/index.duckdb";
const SEARCH_DB_NAME = "search.duckdb";
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
  await instance.registerFileURL(
    SEARCH_DB_NAME,
    databaseUrl,
    duckdb.DuckDBDataProtocol.HTTP,
    true,
  );
  await instance.open({
    path: SEARCH_DB_NAME,
    accessMode: duckdb.DuckDBAccessMode.READ_ONLY,
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

function escapeLike(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulToken(token) {
  if (!token || token.length > 64) return false;
  if (/^[\p{P}\p{S}]+$/u.test(token)) return false;
  if (/^[ぁ-んー]$/u.test(token)) return false;
  return true;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

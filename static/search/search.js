import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";

const KUROMOJI_VERSION = "0.1.2";
const KUROMOJI_SCRIPT = `https://cdn.jsdelivr.net/npm/kuromoji@${KUROMOJI_VERSION}/build/kuromoji.js`;
const KUROMOJI_DICT = `https://cdn.jsdelivr.net/npm/kuromoji@${KUROMOJI_VERSION}/dict/`;
const SEARCH_INDEX_URL = "/search/index.json";
const MAX_RESULTS = 30;
const DEBOUNCE_MS = 180;
const RESULT_COLUMNS = ["title", "url", "date", "reading_time", "description", "tags", "raw_text"];

const input = document.querySelector("[data-search-input]");
const statusEl = document.querySelector("[data-search-status]");
const resultsEl = document.querySelector("[data-search-results]");

let db;
let conn;
let tokenizer;
let ftsReady = false;
let searchTimer = 0;

main().catch((error) => {
  console.error(error);
  setStatus("検索の初期化に失敗しました。時間をおいて再読み込みしてください。");
  if (input) input.disabled = true;
});

async function main() {
  if (!input || !statusEl || !resultsEl) return;

  setInputBusy(true);
  [tokenizer, db] = await Promise.all([initTokenizer(), initDuckDB()]);
  conn = await db.connect();

  const posts = await fetchPosts();
  const searchablePosts = posts.map((post) => buildSearchDocument(post, tokenizer));
  await loadPosts(searchablePosts);
  ftsReady = await initFts();

  setInputBusy(false);
  input.addEventListener("input", scheduleSearch);

  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  input.value = initialQuery;
  if (initialQuery.trim()) {
    await runSearch(initialQuery);
  } else {
    setStatus(`${posts.length}件の記事を検索できます。`);
  }
}

async function initDuckDB() {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerSource = `importScripts("${bundle.mainWorker}");`;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return db;
}

async function initTokenizer() {
  await loadScript(KUROMOJI_SCRIPT);
  return new Promise((resolve, reject) => {
    window.kuromoji.builder({ dicPath: KUROMOJI_DICT }).build((error, tokenizer) => {
      if (error) reject(error);
      else resolve(tokenizer);
    });
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function fetchPosts() {
  const response = await fetch(SEARCH_INDEX_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch search index: ${response.status}`);
  }
  return response.json();
}

function buildSearchDocument(post, tokenizer) {
  const titleTokens = tokenize(post.title, tokenizer);
  const descriptionTokens = tokenize(`${post.description || ""} ${post.summary || ""}`, tokenizer);
  const bodyTokens = tokenize(post.body || "", tokenizer);
  const allTokens = unique([...titleTokens, ...descriptionTokens, ...bodyTokens]);
  const rawText = normalizeText([
    post.title,
    post.description,
    post.summary,
    post.body,
    ...(post.tags || []),
  ].join(" "));

  return {
    id: post.id,
    title: post.title,
    url: post.url,
    date: post.date,
    readingTime: post.readingTime,
    description: post.description || post.summary || "",
    tags: post.tags || [],
    raw_text: rawText,
    title_tokens: titleTokens.join(" "),
    description_tokens: descriptionTokens.join(" "),
    search_tokens: allTokens.join(" "),
    token_blob: ` ${allTokens.join(" ")} `,
  };
}

function tokenize(text, tokenizer) {
  const normalized = normalizeText(text);
  const tokenSet = new Set();

  for (const token of tokenizer.tokenize(normalized)) {
    for (const candidate of tokenCandidates(token)) {
      if (isUsefulToken(candidate)) tokenSet.add(candidate);
    }
  }

  for (const candidate of normalized.match(/[a-z0-9][a-z0-9._+#:-]*/g) || []) {
    if (isUsefulToken(candidate)) tokenSet.add(candidate);
  }

  return [...tokenSet];
}

function tokenCandidates(token) {
  const values = [token.surface_form, token.basic_form].filter(Boolean);
  return values
    .filter((value) => value !== "*")
    .map(normalizeText)
    .flatMap((value) => value.split(/\s+/))
    .filter(Boolean);
}

function isUsefulToken(token) {
  if (!token || token.length > 64) return false;
  if (/^[\p{P}\p{S}]+$/u.test(token)) return false;
  if (/^[ぁ-んー]$/u.test(token)) return false;
  return true;
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function loadPosts(posts) {
  await conn.query("DROP TABLE IF EXISTS posts");
  await conn.query("DROP TABLE IF EXISTS posts_raw");
  await conn.query("DROP SEQUENCE IF EXISTS serial");
  await conn.query("CREATE SEQUENCE serial START 1");
  await db.registerFileText("posts.json", JSON.stringify(posts));
  await conn.insertJSONFromPath("posts.json", {
    name: "posts_raw",
    schema: "main",
  });
  await conn.query(`
    CREATE TABLE posts AS
    SELECT
      nextval('serial')::INTEGER AS row_id,
      id::VARCHAR AS id,
      title::VARCHAR AS title,
      url::VARCHAR AS url,
      date::VARCHAR AS date,
      readingTime::INTEGER AS reading_time,
      description::VARCHAR AS description,
      tags AS tags,
      raw_text::VARCHAR AS raw_text,
      title_tokens::VARCHAR AS title_tokens,
      description_tokens::VARCHAR AS description_tokens,
      search_tokens::VARCHAR AS search_tokens,
      token_blob::VARCHAR AS token_blob
    FROM posts_raw
  `);
}

async function initFts() {
  try {
    await conn.query("INSTALL fts");
    await conn.query("LOAD fts");
    await conn.query(`
      PRAGMA create_fts_index(
        'posts',
        'row_id',
        'title_tokens',
        'description_tokens',
        'search_tokens',
        stemmer = 'none',
        stopwords = 'none',
        ignore = '\\s+',
        strip_accents = 0,
        lower = 0,
        overwrite = 1
      )
    `);
    return true;
  } catch (error) {
    console.warn("DuckDB FTS is unavailable; falling back to SQL matching.", error);
    return false;
  }
}

function scheduleSearch() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    runSearch(input.value).catch((error) => {
      console.error(error);
      setStatus("検索中にエラーが発生しました。");
    });
  }, DEBOUNCE_MS);
}

async function runSearch(query) {
  const rawQuery = query.trim();
  syncQueryString(rawQuery);
  clearResults();

  if (!rawQuery) {
    setStatus("検索語を入力してください。");
    return;
  }

  const queryTokens = tokenize(rawQuery, tokenizer);
  if (!queryTokens.length) {
    setStatus("検索できる語句を入力してください。");
    return;
  }

  setStatus("検索しています...");
  const results = await searchPosts(rawQuery, queryTokens);
  renderResults(results, rawQuery, queryTokens);
}

async function searchPosts(rawQuery, queryTokens) {
  const query = buildSearchQuery(rawQuery, queryTokens);
  const bm25Sql = ftsReady
    ? `fts_main_posts.match_bm25(row_id, ${query.tokenQuery})`
    : "NULL";
  const rows = await conn.query(`
    WITH ranked AS (
      SELECT ${searchSelectSql(query, `${bm25Sql} AS bm25`)}
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
  return rows.toArray();
}

function buildSearchQuery(rawQuery, queryTokens) {
  return {
    phrase: sqlString(normalizeText(rawQuery)),
    tokenQuery: sqlString(queryTokens.join(" ")),
    tokenScore: tokenScoreSql(queryTokens),
    tokenWhere: tokenWhereSql(queryTokens),
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

function tokenWhereSql(tokens) {
  return tokens
    .map((token) => `token_blob LIKE '% ${escapeLike(token)} %' ESCAPE '\\'`)
    .join(" OR ");
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

function renderResults(results, rawQuery, queryTokens) {
  clearResults();

  if (!results.length) {
    setStatus(`「${rawQuery}」に一致する記事はありません。`);
    return;
  }

  setStatus(`${results.length}件の記事が見つかりました。`);
  const highlightTerms = buildHighlightTerms(rawQuery, queryTokens);
  const fragment = document.createDocumentFragment();
  for (const result of results) {
    fragment.appendChild(renderResult(result, highlightTerms));
  }
  resultsEl.appendChild(fragment);
}

function renderResult(result, highlightTerms) {
  const item = createElement("li", "search-result");

  const title = createElement("a", "search-result-title");
  title.href = result.url;
  appendHighlightedText(title, result.title, highlightTerms);

  const meta = createElement(
    "span",
    "search-result-meta",
    `${formatDate(result.date)} - ${result.reading_time} min read`,
  );
  const description = createElement("p", "search-result-description");
  appendHighlightedText(description, result.description || "No description.", highlightTerms);

  item.append(title, meta, description);

  const excerpt = createMatchedExcerpt(result.raw_text, highlightTerms, [
    result.title,
    result.description,
  ]);
  if (excerpt) {
    const excerptEl = createElement("p", "search-result-excerpt");
    const label = createElement("span", "search-result-excerpt-label", "本文: ");
    excerptEl.appendChild(label);
    appendHighlightedText(excerptEl, excerpt, highlightTerms);
    item.appendChild(excerptEl);
  }

  const tags = normalizeTags(result.tags);
  if (tags.length) {
    item.appendChild(createElement("div", "search-result-tags", tags.map((tag) => `#${tag}`).join(" ")));
  }

  return item;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (tags && typeof tags.toArray === "function") return tags.toArray();
  return [];
}

function createMatchedExcerpt(text, highlightTerms, alreadyVisibleTexts = []) {
  const normalized = normalizeText(text);
  const matchIndex = findFirstMatchIndex(normalized, highlightTerms);
  if (matchIndex < 0) return "";

  const visibleText = normalizeText(alreadyVisibleTexts.join(" "));
  const matchedTerm = findMatchedTermAt(normalized, matchIndex, highlightTerms);
  if (matchedTerm && visibleText.includes(normalizeText(matchedTerm))) return "";

  const start = Math.max(0, matchIndex - 42);
  const end = Math.min(normalized.length, matchIndex + 110);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

function buildHighlightTerms(rawQuery, queryTokens) {
  const terms = unique([normalizeText(rawQuery), ...queryTokens.map(normalizeText)])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const hasLongTerm = terms.some((term) => term.length > 1);
  return terms.filter((term) => !hasLongTerm || term.length > 1);
}

function appendHighlightedText(parent, text, terms) {
  const source = String(text || "");
  const regex = highlightRegex(terms);
  if (!regex) {
    parent.textContent = source;
    return;
  }

  let cursor = 0;
  for (const match of source.matchAll(regex)) {
    const value = match[0];
    const index = match.index || 0;
    if (index > cursor) parent.appendChild(document.createTextNode(source.slice(cursor, index)));

    const mark = document.createElement("mark");
    mark.textContent = value;
    parent.appendChild(mark);
    cursor = index + value.length;
  }

  if (cursor < source.length) parent.appendChild(document.createTextNode(source.slice(cursor)));
}

function highlightRegex(terms) {
  const escaped = terms.map(escapeRegExp).filter(Boolean);
  return escaped.length ? new RegExp(escaped.join("|"), "giu") : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFirstMatchIndex(text, terms) {
  const normalizedText = normalizeText(text);
  return terms.reduce((bestIndex, term) => {
    const index = normalizedText.indexOf(normalizeText(term));
    if (index < 0) return bestIndex;
    if (bestIndex < 0) return index;
    return Math.min(bestIndex, index);
  }, -1);
}

function findMatchedTermAt(text, index, terms) {
  const normalizedText = normalizeText(text);
  return terms.find((term) => normalizedText.startsWith(normalizeText(term), index)) || "";
}

function formatDate(value) {
  if (!value) return "";
  const text = String(value);
  const datePart = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return text;
  const date = new Date(`${datePart}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function clearResults() {
  resultsEl.replaceChildren();
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setInputBusy(busy) {
  input.disabled = busy;
}

function syncQueryString(query) {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  window.history.replaceState({}, "", url);
}

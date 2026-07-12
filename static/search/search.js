import { escapeRegExp, normalizeText, unique } from "./search-utils.js";

const DEBOUNCE_MS = 180;
const WORKER_URL = "/search/search-worker.js?v=duckdb-index";

const input = document.querySelector("[data-search-input]");
const statusEl = document.querySelector("[data-search-status]");
const resultsEl = document.querySelector("[data-search-results]");
const worker = new Worker(WORKER_URL, { type: "module" });

let searchTimer = 0;
let requestId = 0;
const pendingRequests = new Map();

worker.onmessage = (event) => {
  const { id, type, message } = event.data;
  const request = pendingRequests.get(id);
  if (!request) return;

  pendingRequests.delete(id);
  if (type === "error") request.reject(new Error(message));
  else request.resolve(event.data);
};

main().catch((error) => {
  console.error(error);
  setStatus("検索の初期化に失敗しました。時間をおいて再読み込みしてください。");
  setInputBusy(true);
});

async function main() {
  if (!input || !statusEl || !resultsEl) return;

  setInputBusy(true);
  const { count } = await postWorker("init");
  setInputBusy(false);
  input.addEventListener("input", scheduleSearch);

  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  input.value = initialQuery;
  if (initialQuery.trim()) await runSearch(initialQuery);
  else setStatus(`${count}件の記事を検索できます。`);
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

  setStatus("検索しています...");
  const { results } = await postWorker("search", { query: rawQuery });
  renderResults(results.rows, rawQuery, results.queryTokens);
}

function postWorker(type, payload = {}) {
  const id = ++requestId;
  worker.postMessage({ id, type, ...payload });
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });
}

function renderResults(results, rawQuery, queryTokens) {
  if (!queryTokens.length) {
    setStatus("検索できる語句を入力してください。");
    return;
  }

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
    excerptEl.appendChild(createElement("span", "search-result-excerpt-label", "本文: "));
    appendHighlightedText(excerptEl, excerpt, highlightTerms);
    item.appendChild(excerptEl);
  }

  if (result.tags.length) {
    item.appendChild(createElement("div", "search-result-tags", result.tags.map((tag) => `#${tag}`).join(" ")));
  }

  return item;
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
  return `${start > 0 ? "..." : ""}${normalized.slice(start, end)}${end < normalized.length ? "..." : ""}`;
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

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
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

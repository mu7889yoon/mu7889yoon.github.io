import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import kuromoji from "kuromoji";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "public/search/index.json");
const outputPath = path.join(rootDir, "public/search/index.duckdb");
const tempDir = path.join(rootDir, "public/search/.build-search-index");
const tokenizedPath = path.join(tempDir, "posts.json");
const dictPath = path.join(rootDir, "node_modules/kuromoji/dict");

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: dictPath }).build((error, tokenizer) => {
    if (error) reject(error);
    else resolve(tokenizer);
  });
});

const posts = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const indexedPosts = posts.map(buildSearchDocument);

await fs.rm(outputPath, { force: true });
await fs.rm(tempDir, { force: true, recursive: true });
await fs.mkdir(tempDir, { recursive: true });
await fs.writeFile(tokenizedPath, `${JSON.stringify(indexedPosts)}\n`);

const result = spawnSync("duckdb", [outputPath], {
  cwd: rootDir,
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: tempDir,
  },
  input: buildDuckDbSql(tokenizedPath, tempDir),
});

if (result.error) {
  throw new Error(`Failed to run duckdb CLI: ${result.error.message}`);
}

if (result.status !== 0) {
  throw new Error([
    `duckdb CLI exited with status ${result.status}`,
    result.stdout,
    result.stderr,
  ].filter(Boolean).join("\n"));
}

await fs.rm(tempDir, { force: true, recursive: true });
console.log(`Wrote ${indexedPosts.length} indexed posts to ${path.relative(rootDir, outputPath)}`);

function buildSearchDocument(post) {
  const titleTokens = tokenize(post.title);
  const descriptionTokens = tokenize(`${post.description || ""} ${post.summary || ""}`);
  const bodyTokens = tokenize(post.body || "");
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

function tokenize(text) {
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

function buildDuckDbSql(jsonPath, extensionDir) {
  const source = sqlString(jsonPath);
  const extensions = sqlString(path.join(extensionDir, "extensions"));
  return `
SET extension_directory = ${extensions};
INSTALL fts;
LOAD fts;

CREATE TABLE posts AS
SELECT
  row_number() OVER ()::INTEGER AS row_id,
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
FROM read_json_auto(${source});

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
);

CHECKPOINT;
`.trimStart();
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

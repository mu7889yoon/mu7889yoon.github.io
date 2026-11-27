import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDirectory = path.join(root, 'content', 'posts');
const thumbnailsDirectory = path.join(root, 'static', 'images', 'thumbnails');
const width = 1200;
const height = 630;
const maxTextWidth = width - 160;
const fontFamily = '"Noto Sans CJK JP", sans-serif';
const wordSegmenter = new Intl.Segmenter('ja', { granularity: 'word' });
const graphemeSegmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const openingPunctuation = new Set(Array.from('（「『【〔〈《［｛([{'));
const closingPunctuation = new Set(Array.from('、。，．・：；？！）」』】〕〉》］｝)]}'));

function getTitle(markdown, filePath) {
  const frontMatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontMatter) {
    throw new Error(`Missing YAML front matter: ${filePath}`);
  }

  const metadata = parse(frontMatter[1]) ?? {};
  if (metadata.draft === true) return null;

  const title = String(metadata.title ?? '').trim();
  if (!title) {
    throw new Error(`Missing title in YAML front matter: ${filePath}`);
  }
  return title;
}

function splitTrailingOpeners(line) {
  const graphemes = [...graphemeSegmenter.segment(line)].map(({ segment }) => segment);
  let openers = '';
  while (graphemes.length && openingPunctuation.has(graphemes.at(-1))) {
    openers = graphemes.pop() + openers;
  }
  return { line: graphemes.join(''), openers };
}

function firstNonSpaceGrapheme(text) {
  return [...graphemeSegmenter.segment(text)]
    .map(({ segment }) => segment)
    .find((segment) => !/^\s+$/u.test(segment));
}

function wrapParagraph(ctx, paragraph, fontSize) {
  const lines = [];
  let line = '';

  function addGraphemes(text) {
    for (const { segment } of graphemeSegmenter.segment(text)) {
      if (ctx.measureText(line + segment).width <= maxTextWidth || !line) {
        line += segment;
        continue;
      }

      if (closingPunctuation.has(segment) && ctx.measureText(line + segment).width <= maxTextWidth + fontSize) {
        line += segment;
        continue;
      }

      const split = splitTrailingOpeners(line);
      if (split.line.trimEnd()) lines.push(split.line.trimEnd());
      line = split.openers + segment;
    }
  }

  for (const { segment } of wordSegmenter.segment(paragraph)) {
    if (ctx.measureText(line + segment).width <= maxTextWidth) {
      line += segment;
      continue;
    }

    const first = firstNonSpaceGrapheme(segment);
    if (line && first && closingPunctuation.has(first)) {
      // Keep Japanese closing punctuation with the text before it.
      line += segment;
      continue;
    }

    const split = splitTrailingOpeners(line);
    if (split.line.trimEnd()) lines.push(split.line.trimEnd());
    line = split.openers;
    addGraphemes(segment.trimStart());
  }

  if (line || lines.length === 0) lines.push(line.trimEnd());
  return lines;
}

function wrapText(ctx, text, fontSize) {
  return String(text)
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .flatMap((paragraph) => paragraph.length === 0 ? [''] : wrapParagraph(ctx, paragraph, fontSize));
}

function truncateLine(ctx, line, fontSize) {
  const ellipsis = '...';
  const graphemes = [...graphemeSegmenter.segment(line)].map(({ segment }) => segment);
  while (graphemes.length && ctx.measureText(graphemes.join('') + ellipsis).width > maxTextWidth) {
    graphemes.pop();
  }
  return graphemes.join('') + ellipsis;
}

function drawThumbnail(title) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const theme = {
    bg1: '#fafafa',
    bg2: '#f0f0f0',
    accent: '#333333',
    text: '#1a1a1a',
    subtext: '#666666',
  };

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, theme.bg1);
  background.addColorStop(1, theme.bg2);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.1;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(width * 0.85, height * 0.2, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.1, height * 0.8, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const accentBar = ctx.createLinearGradient(0, 0, width, 0);
  accentBar.addColorStop(0, theme.accent);
  accentBar.addColorStop(0.5, theme.accent);
  accentBar.addColorStop(1, 'transparent');
  ctx.fillStyle = accentBar;
  ctx.fillRect(0, 0, width, 6);

  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(60, height - 100, width - 120, 2);
  ctx.globalAlpha = 1;

  let fontSize = 64;
  let lines;
  do {
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, title, fontSize);
    if (lines.length <= 3) break;
    fontSize -= 4;
  } while (fontSize > 32);

  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    lines[2] = truncateLine(ctx, lines[2], fontSize);
  }

  const lineHeight = fontSize * 1.4;
  const startY = (height - lines.length * lineHeight) / 2 + fontSize / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillText(line, width / 2 + 2, y + 2);
    ctx.fillStyle = theme.text;
    ctx.fillText(line, width / 2, y);
  });

  ctx.font = `600 24px ${fontFamily}`;
  ctx.fillStyle = theme.subtext;
  ctx.textAlign = 'left';
  ctx.fillText('よ〜んの雑記', 80, height - 50);

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(60, height - 50, 6, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

await mkdir(thumbnailsDirectory, { recursive: true });
const posts = (await readdir(postsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_index.md')
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

let created = 0;
let skipped = 0;
for (const post of posts) {
  const outputPath = path.join(thumbnailsDirectory, `${path.basename(post.name, '.md')}.png`);
  try {
    await readFile(outputPath);
    skipped += 1;
    continue;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const postPath = path.join(postsDirectory, post.name);
  const title = getTitle(await readFile(postPath, 'utf8'), postPath);
  if (title === null) {
    skipped += 1;
    continue;
  }

  await writeFile(outputPath, drawThumbnail(title));
  created += 1;
  console.log(`Generated ${path.relative(root, outputPath)}`);
}

console.log(`OGP thumbnails: ${created} generated, ${skipped} already present or draft.`);

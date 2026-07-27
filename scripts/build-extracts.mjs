/**
 * build-extracts.mjs
 *
 * Fetches the lead-section extract of each problem's own Wikipedia article and
 * writes src/data/extracts.generated.json.
 *
 * Why a second dataset file rather than more fields on the first: the extracts
 * total roughly half a megabyte, and the atlas list never shows them. Keeping
 * them separate lets the detail view load them through a dynamic import, so
 * browsing 591 rows does not pay for prose only one page at a time can display.
 *
 * Same rule as build-dataset.mjs: nothing is invented. An article with no
 * extract, or that does not exist, is recorded as absent. It is not summarised,
 * paraphrased or generated.
 *
 * Provenance caveat carried into the data: when a problem's link points at a
 * section of a broader article (wikipediaAnchor is set), the lead extract
 * describes the whole article, not that section. Those entries are flagged
 * `scope: 'article'` so the UI can say so rather than implying the text is
 * about this specific problem.
 *
 * Usage:  node scripts/build-extracts.mjs [--limit N]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IN = resolve(REPO, 'src/data/problems.generated.json');
const OUT = resolve(REPO, 'src/data/extracts.generated.json');

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'OpenProblemsAtlas/1.0 (dataset build script; https://github.com/mizcausevic-dev/open-problems-atlas)';

/** MediaWiki allows 20 titles per extracts request for anonymous clients. */
const BATCH = 20;
/** Politeness gap between batches. The API asks for serial requests, not a flood. */
const GAP_MS = 120;
/** Roughly two paragraphs. Longer leads are cut at a sentence boundary. */
const MAX_CHARS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Repair the way MediaWiki renders <math> into plain text.
 *
 * `explaintext` turns a formula into the bare symbol, then a separate paragraph
 * containing the TeX wrapped in {\displaystyle ...}. Read straight, the Riemann
 * hypothesis extract says:
 *
 *     The Riemann zeta function
 *
 *     ζ
 *
 *     {\displaystyle \zeta }
 *
 *     is a function whose argument may be...
 *
 * which is both duplicated and full of raw markup. This collapses each pair
 * into a single `$...$` span that KaTeX can typeset inline, dropping the
 * duplicate symbol that precedes it.
 */
function repairMath(text) {
  let out = '';
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf('{\\displaystyle', i);
    if (start === -1) {
      out += text.slice(i);
      break;
    }

    // Walk to the matching close brace: TeX nests, so indexOf('}') is wrong.
    let depth = 0;
    let end = -1;
    for (let j = start; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) {
      out += text.slice(i);
      break;
    }

    const tex = text
      .slice(start + '{\\displaystyle'.length, end)
      .trim()
      .replace(/\s+/g, ' ')
      // A nested block can leave a second \displaystyle inside the captured
      // TeX. KaTeX accepts it, but it is redundant, so it goes.
      .replace(/^\\displaystyle\s*/, '');
    let before = out + text.slice(i, start);

    // Drop the bare symbol MediaWiki emitted just before the TeX block, so the
    // formula is not printed twice.
    before = before.replace(/\n\s*\S{1,40}\s*\n\s*$/, '\n');

    out = `${before.replace(/\s+$/, '')} ${tex ? `$${tex}$` : ''}`;
    i = end + 1;

    // Swallow the blank line the block left behind so the sentence reflows.
    const rest = text.slice(i);
    const gap = /^\s*\n\s*/.exec(rest);
    if (gap && /^[a-z(]/.test(rest.slice(gap[0].length))) i += gap[0].length - 1;
  }

  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:?!])/g, '$1')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Drop a trailing unterminated `$...$` span.
 *
 * The renderer treats `$` pairs as maths. An odd number means an opening
 * delimiter with no partner, which makes KaTeX swallow everything after it —
 * the rest of the paragraph vanishes into a failed formula. Truncating at a
 * sentence boundary can land inside a formula and produce exactly that, which
 * it did for three extracts.
 */
function balanceMath(s) {
  const count = (s.match(/\$/g) ?? []).length;
  if (count % 2 === 0) return s;
  return s.slice(0, s.lastIndexOf('$')).replace(/[\s,;:]+$/, '');
}

/** Trim to MAX_CHARS without cutting mid-sentence, and never mid-word. */
function trim(text) {
  const clean = balanceMath(repairMath(text).replace(/\n{3,}/g, '\n\n').trim());
  if (clean.length <= MAX_CHARS) return { text: clean, truncated: false };

  const window = clean.slice(0, MAX_CHARS);
  // Prefer the last sentence end that still leaves a substantial extract.
  const lastStop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'));
  const cut = lastStop > MAX_CHARS * 0.5 ? lastStop + 1 : window.lastIndexOf(' ');
  return { text: balanceMath(clean.slice(0, cut).trim()), truncated: true };
}

async function fetchBatch(titles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exlimit: String(BATCH),
    redirects: '1',
    titles: titles.join('|'),
  });

  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  // The API rewrites titles two ways before answering. Both maps have to be
  // followed backwards or extracts land under a key no problem refers to.
  const alias = new Map();
  for (const n of json.query?.normalized ?? []) alias.set(n.to, n.from);
  for (const r of json.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);

  const out = new Map();
  for (const page of json.query?.pages ?? []) {
    const requested = alias.get(page.title) ?? page.title;
    if (page.missing || !page.extract?.trim()) continue;
    out.set(requested, { resolvedTitle: page.title, extract: page.extract });
  }
  return out;
}

async function main() {
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity;

  const dataset = JSON.parse(readFileSync(IN, 'utf8'));
  const linked = dataset.problems.filter((p) => p.wikipediaTitle).slice(0, limit);

  // Several problems point at the same article; fetch each article once.
  const byTitle = new Map();
  for (const p of linked) {
    const list = byTitle.get(p.wikipediaTitle) ?? [];
    list.push(p);
    byTitle.set(p.wikipediaTitle, list);
  }

  const titles = [...byTitle.keys()];
  console.log(`${dataset.problems.length} problems, ${linked.length} with an article, ${titles.length} distinct articles`);
  console.log(`Fetching in ${Math.ceil(titles.length / BATCH)} batches of ${BATCH}...`);

  const extracts = {};
  let missing = 0;
  let truncatedCount = 0;

  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH);
    let results;
    try {
      results = await fetchBatch(chunk);
    } catch (err) {
      // One failed batch must not lose the other 29. Record and continue; the
      // affected problems simply have no extract, which the UI already handles.
      console.warn(`  batch ${i / BATCH + 1} failed (${err.message}); continuing`);
      missing += chunk.length;
      await sleep(GAP_MS * 4);
      continue;
    }

    for (const title of chunk) {
      const hit = results.get(title);
      if (!hit) {
        missing++;
        continue;
      }
      const { text, truncated } = trim(hit.extract);
      if (truncated) truncatedCount++;

      for (const problem of byTitle.get(title) ?? []) {
        extracts[problem.id] = {
          text,
          truncated,
          resolvedTitle: hit.resolvedTitle,
          // 'article' means the link targets a section of a broader article, so
          // this lead describes the article rather than this problem alone.
          scope: problem.wikipediaAnchor ? 'article' : 'problem',
        };
      }
    }

    process.stdout.write(`\r  ${Math.min(i + BATCH, titles.length)}/${titles.length} articles`);
    await sleep(GAP_MS);
  }

  const covered = Object.keys(extracts).length;
  const payload = {
    meta: {
      generatedBy: 'scripts/build-extracts.mjs',
      generatedAt: new Date().toISOString().slice(0, 10),
      source: {
        api: 'https://en.wikipedia.org/w/api.php (action=query&prop=extracts&exintro)',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
      maxChars: MAX_CHARS,
      counts: {
        problemsWithExtract: covered,
        problemsTotal: dataset.problems.length,
        articlesRequested: titles.length,
        articlesWithoutExtract: missing,
        truncated: truncatedCount,
      },
    },
    extracts,
  };

  writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');

  const kb = (JSON.stringify(payload).length / 1024).toFixed(0);
  console.log(`\n\nWrote ${OUT} (${kb} KB)`);
  console.log(`  ${covered}/${dataset.problems.length} problems have an extract`);
  console.log(`  ${missing} articles returned nothing, ${truncatedCount} extracts trimmed to ${MAX_CHARS} chars`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

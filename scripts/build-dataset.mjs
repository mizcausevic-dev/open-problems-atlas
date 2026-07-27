/**
 * build-dataset.mjs
 *
 * Generates src/data/problems.generated.json from the live Wikipedia article
 * "List of unsolved problems in mathematics".
 *
 * Design rule: this script NEVER invents a field. Every value written to the
 * dataset is either (a) parsed out of the source wikitext, (b) derived
 * deterministically from parsed values, or (c) a small hardcoded set of
 * externally verifiable facts (the seven Millennium Prize Problems and their
 * conventional field), which are tagged `fieldSource: "curated"` so the UI can
 * tell the difference. If a value cannot be parsed it is omitted, not guessed.
 * Downstream UI must treat "missing" as "unknown", never as zero.
 *
 * Usage:
 *   node scripts/build-dataset.mjs                       # fetch live
 *   node scripts/build-dataset.mjs --cache wikitext.json # replay a fetch
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

const SOURCE_PAGE = 'List_of_unsolved_problems_in_mathematics';
const API = `https://en.wikipedia.org/w/api.php?action=parse&page=${SOURCE_PAGE}&prop=wikitext%7Crevid&format=json&formatversion=2`;
const UA = 'OpenProblemsAtlas/1.0 (dataset build script; https://github.com/mizcausevic-dev/open-problems-atlas)';

/**
 * The seven Clay Millennium Prize Problems, keyed by Wikipedia article title.
 * Six of them appear in the article only inside the "Notable lists" section,
 * outside the by-field taxonomy, so their field has to be supplied here. The
 * field assignment is conventional classification, not parsed text, which is
 * why every entry created from this table is stamped fieldSource: "curated".
 */
const MILLENNIUM = {
  'Birch and Swinnerton-Dyer conjecture': { field: 'Number theory', subfield: 'Arithmetic geometry' },
  'Hodge conjecture': { field: 'Geometry', subfield: 'Algebraic geometry' },
  'Navier–Stokes existence and smoothness': { field: 'Analysis' },
  'P versus NP problem': { field: 'Theoretical computer science' },
  'Riemann hypothesis': { field: 'Number theory', subfield: 'Analytic number theory' },
  'Yang–Mills existence and mass gap': { field: 'Analysis' },
  'Poincaré conjecture': { field: 'Topology' },
};

/** Headings used only in the "solved" half of the article, mapped onto the main taxonomy. */
const FIELD_ALIASES = {
  'Group theory': 'Algebra',
  'Ramsey theory': 'Combinatorics',
  'Game theory': 'Games and puzzles',
};

const FIELD_ORDER = [
  'Number theory',
  'Geometry',
  'Graph theory',
  'Algebra',
  'Analysis',
  'Combinatorics',
  'Topology',
  'Dynamical systems',
  'Theoretical computer science',
  'Model theory and formal languages',
  'Set theory',
  'Probability theory',
  'Games and puzzles',
  'Uncategorised',
];

// ---------------------------------------------------------------------------
// wikitext normalisation
// ---------------------------------------------------------------------------

/**
 * Wikipedia citations and templates wrap across many source lines, but the list
 * structure we care about is line-based. Collapse newlines that occur *inside*
 * a <ref> block or a {{template}} so that one bullet is always one line.
 */
function collapseMultiline(text) {
  let out = '';
  let braceDepth = 0;
  let inRef = false;

  for (let i = 0; i < text.length; i++) {
    if (!inRef && text.startsWith('<ref', i) && /[\s>]/.test(text[i + 4] ?? '')) {
      const close = text.indexOf('>', i);
      if (close !== -1 && text[close - 1] !== '/') inRef = true;
    } else if (inRef && text.startsWith('</ref>', i)) {
      inRef = false;
      out += '</ref>';
      i += 5;
      continue;
    }

    if (text.startsWith('{{', i)) { braceDepth++; out += '{{'; i++; continue; }
    if (text.startsWith('}}', i) && braceDepth > 0) { braceDepth--; out += '}}'; i++; continue; }

    if (text[i] === '\n' && (inRef || braceDepth > 0)) { out += ' '; continue; }
    out += text[i];
  }
  return out;
}

/** Remove balanced {{...}} templates. Regex cannot do this: templates nest. */
function stripTemplates(s) {
  let out = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith('{{', i)) { depth++; i++; continue; }
    if (s.startsWith('}}', i) && depth > 0) { depth--; i++; continue; }
    if (depth === 0) out += s[i];
  }
  return out;
}

/** Pull citation metadata out of <ref> blocks before discarding them. */
function extractRefs(s) {
  const refs = [];
  const re = /<ref[^>]*?>([\s\S]*?)<\/ref>/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const body = m[1];
    const field = (name) => new RegExp(`\\|\\s*${name}\\s*=\\s*([^|}\\n]+)`, 'i').exec(body)?.[1]?.trim();
    const url = field('url') ?? field('archive-url');
    const title = field('title');
    const doi = field('doi');
    const arxiv = field('arxiv');
    const year = field('year') ?? field('date');
    if (url || title || doi || arxiv) {
      refs.push({
        ...(title ? { title: cleanInline(resolveLinks(title)) } : {}),
        ...(url ? { url } : {}),
        ...(doi ? { doi } : {}),
        ...(arxiv ? { arxiv } : {}),
        ...(year ? { year: cleanInline(year) } : {}),
      });
    }
  }
  return refs;
}

function stripRefs(s) {
  return s.replace(/<ref[^>]*?>[\s\S]*?<\/ref>/g, '').replace(/<ref[^>]*?\/>/g, '');
}

/** <math>x^2</math> -> $x^2$ so the renderer can hand the body to KaTeX. */
function convertMath(s) {
  return s.replace(/<math[^>]*>([\s\S]*?)<\/math>/g, (_, tex) => `$${tex.trim().replace(/\s+/g, ' ')}$`);
}

function collectLinks(s) {
  const links = [];
  const re = /\[\[([^\][]+?)\]\]/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = m[1];
    const pipe = raw.indexOf('|');
    const targetRaw = pipe === -1 ? raw : raw.slice(0, pipe);
    const displayRaw = pipe === -1 ? undefined : raw.slice(pipe + 1);
    const hash = targetRaw.indexOf('#');
    const target = (hash === -1 ? targetRaw : targetRaw.slice(0, hash)).trim();
    if (!target || /^(File|Image|Category|wikt|s|:):/i.test(target)) continue;
    links.push({
      target,
      anchor: hash === -1 ? undefined : targetRaw.slice(hash + 1).trim(),
      display: (displayRaw ?? (hash === -1 ? targetRaw : targetRaw.slice(hash + 1))).trim(),
    });
  }
  return links;
}

/**
 * Replace every [[wikilink]] with a same-length run of a filler character.
 *
 * Used before scanning for the trailing "(Solver, Year)" attribution. Link
 * targets can themselves contain parentheses -- [[Aleksandar Nikolov (computer
 * scientist)|...]] -- which breaks any bracket-matching over the raw text.
 * Because the mask preserves length, a match index in the masked string is
 * still a valid index into the original.
 */
const MASK_CHAR = String.fromCharCode(2);

function maskLinks(s) {
  return s.replace(/\[\[[^\][]*?\]\]/g, (m) => MASK_CHAR.repeat(m.length));
}

function resolveLinks(s) {
  return s.replace(/\[\[([^\][]+?)\]\]/g, (_, raw) => {
    const pipe = raw.indexOf('|');
    const targetRaw = pipe === -1 ? raw : raw.slice(0, pipe);
    if (/^(File|Image|Category):/i.test(targetRaw)) return '';
    if (pipe !== -1) return raw.slice(pipe + 1).trim();
    const hash = targetRaw.indexOf('#');
    return (hash === -1 ? targetRaw : targetRaw.slice(hash + 1)).trim();
  });
}

function cleanInline(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&minus;/g, '−')
    .replace(/<\/?(?:small|big|sup|sub|span|br\s*\/?|nowiki|div|em|i|b)[^>]*>/g, '')
    .replace(/\[https?:\/\/\S+?\s+([^\]]+)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const MATH_SENTINEL = String.fromCharCode(1);

/**
 * Full pipeline for a bullet's prose.
 *
 * Maths is lifted out to placeholders before templates are stripped. Both
 * LaTeX and wiki templates use braces, so a formula such as \frac{{a}}{b} would
 * otherwise be read as a template and deleted. Pulling the maths out first
 * makes the two syntaxes impossible to confuse.
 */
function cleanProse(line) {
  const maths = [];
  const withPlaceholders = stripRefs(line).replace(
    /<math[^>]*>([\s\S]*?)<\/math>/g,
    (_, tex) => {
      maths.push(tex.trim().replace(/\s+/g, ' '));
      return `${MATH_SENTINEL}${maths.length - 1}${MATH_SENTINEL}`;
    },
  );

  const cleaned = cleanInline(resolveLinks(stripTemplates(withPlaceholders)));

  return cleaned.replace(
    new RegExp(`${MATH_SENTINEL}(\\d+)${MATH_SENTINEL}`, 'g'),
    (_, i) => `$${maths[Number(i)]}$`,
  );
}

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[ıİ]/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function trimLeadingTitle(desc, title) {
  let d = desc;
  if (d.toLowerCase().startsWith(title.toLowerCase())) d = d.slice(title.length);
  return d.replace(/^\s*(?:that\s+|on\s+|:|,|;|–|—|-)\s*/i, '').trim();
}

/** "(Grigori Perelman, 2003)" trailing a solved entry. */
function extractSolution(desc) {
  const m = /\(([^()]*?\b(?:19|20)\d{2}\b[^()]*?)\)\s*$/.exec(desc);
  if (!m) {
    const y = /\b(?:19|20)\d{2}\b/.exec(desc);
    return { solvedYear: y ? Number(y[0]) : undefined, solvedBy: undefined, rest: desc };
  }
  const inner = m[1].trim();
  const year = Number(/\b(?:19|20)\d{2}\b/.exec(inner)?.[0]);
  const solvedBy = inner
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/\b(?:using|with|via|announced|published|preprint)\b[\s\S]*$/i, '')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return {
    solvedYear: Number.isFinite(year) ? year : undefined,
    solvedBy: solvedBy.length > 2 && solvedBy.length < 140 ? solvedBy : undefined,
    rest: desc.slice(0, m.index).trim(),
  };
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

function parse(wikitext, revid) {
  const lines = collapseMultiline(wikitext).split('\n');
  const byId = new Map();
  const entries = [];

  let h2 = '', h3 = '', h4 = '';
  /** Most recent entry at each bullet depth, so `**` can find its `*` parent. */
  const stack = [];

  const push = (entry) => {
    const existing = byId.get(entry.id);
    if (existing) {
      // Same article listed twice. This is not noise: the article genuinely
      // lists some conjectures as open in one case and settled in another (the
      // Jacobian conjecture is open in 2-D and disproven above 2-D). Blending
      // the two into one record would state something the source does not, so
      // keep both as explicit variants and mark the parent partially solved.
      if (entry.field !== existing.field && !existing.alsoIn?.includes(entry.field)) {
        (existing.alsoIn ??= []).push(entry.field);
      }
      const differs =
        entry.status !== existing.status ||
        (entry.description && entry.description !== existing.description);
      if (differs) {
        (existing.variants ??= []).push({
          status: entry.status,
          field: entry.field,
          ...(entry.description ? { description: entry.description } : {}),
          ...(entry.solvedYear ? { solvedYear: entry.solvedYear } : {}),
          ...(entry.solvedBy ? { solvedBy: entry.solvedBy } : {}),
          ...(entry.references ? { references: entry.references } : {}),
        });
      }
      if (entry.status !== existing.status) existing.status = 'partially-solved';
      if (entry.description && !existing.description) existing.description = entry.description;
      return existing;
    }
    byId.set(entry.id, entry);
    entries.push(entry);
    return entry;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const h = /^(={2,4})\s*(.+?)\s*\1\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = cleanInline(resolveLinks(h[2]));
      if (level === 2) { h2 = text; h3 = ''; h4 = ''; }
      if (level === 3) { h3 = text; h4 = ''; }
      if (level === 4) { h4 = text; }
      stack.length = 0;
      continue;
    }

    const inUnsolved = h2 === 'Unsolved problems';
    const inSolved = h2 === 'Problems solved since 1995';
    if (!inUnsolved && !inSolved) continue;

    const bullet = /^(\*+)\s*(\S[\s\S]*)$/.exec(line);
    if (!bullet) continue;

    const depth = bullet[1].length;
    const body = bullet[2];

    /**
     * Choose the title link from the statement only, never from the trailing
     * "(Solver, Year)" parenthetical and never from inside a <ref>.
     *
     * Without this, a solved entry written as
     *   * Beck's conjecture on ... (Alantha Newman, [[Aleksandar Nikolov]], 2011)
     * takes the first wikilink in the line and ends up titled after the person
     * who settled it. Solver names are people, not problems.
     */
    const withoutRefs = stripRefs(body);
    const attribution = /\(([^()]*?\b(?:19|20)\d{2}\b[^()]*?)\)\s*$/.exec(maskLinks(withoutRefs));
    const statement = attribution ? withoutRefs.slice(0, attribution.index) : withoutRefs;
    const links = collectLinks(statement);

    const prose = cleanProse(body);
    let title;
    let primary = links[0];

    if (primary) {
      title = cleanInline(resolveLinks(convertMath(primary.display)));
    } else {
      // No linked article for this entry. A bullet ending in a colon is a
      // grouping line ("Location of nontrivial zeros of L-functions:"), so keep
      // it on the stack for its children but do not emit it as a problem.
      const bare = cleanProse(statement).replace(/[:\s]+$/, '');
      if (!bare || cleanProse(statement).trim().endsWith(':')) {
        stack[depth] = null;
        continue;
      }
      // Keep it, titled from its own prose, with no article to link to. The
      // schema makes wikipediaTitle optional precisely for this case.
      title = bare.length > 110 ? `${bare.slice(0, 107).trimEnd()}...` : bare;
      primary = undefined;
    }

    if (!title || title.length > 160) continue;

    let description = trimLeadingTitle(prose, title);
    let solvedYear, solvedBy;
    if (inSolved) {
      const sol = extractSolution(description);
      solvedYear = sol.solvedYear;
      solvedBy = sol.solvedBy;
      description = trimLeadingTitle(sol.rest, title);
    }

    const rawField = h3 || 'Uncategorised';
    const field = FIELD_ALIASES[rawField] ?? rawField;
    const subfield = FIELD_ALIASES[rawField] ? rawField : h4 || undefined;
    const refs = extractRefs(body);

    // Find nearest ancestor at a shallower depth.
    let parentId;
    for (let d = depth - 1; d >= 1; d--) {
      if (stack[d]) { parentId = stack[d].id; break; }
    }

    const entry = push({
      id: slugify(primary?.target ?? title) || slugify(title),
      title,
      ...(primary ? { wikipediaTitle: primary.target } : {}),
      ...(primary?.anchor ? { wikipediaAnchor: primary.anchor } : {}),
      field,
      fieldSource: 'wikipedia-section',
      ...(subfield ? { subfield } : {}),
      status: inSolved ? 'solved' : 'open',
      depth,
      ...(parentId ? { parentId } : {}),
      ...(description ? { description } : {}),
      ...(solvedYear ? { solvedYear } : {}),
      ...(solvedBy ? { solvedBy } : {}),
      ...(inSolved
        ? {}
        : { relatedTopics: links.slice(1, 6).map((l) => l.target).filter((t) => t !== primary?.target) }),
      ...(refs.length ? { references: refs.slice(0, 4) } : {}),
    });

    stack[depth] = entry;
    stack.length = depth + 1;
  }

  // Millennium Prize Problems: flag the ones already present, create the rest.
  for (const [target, curated] of Object.entries(MILLENNIUM)) {
    const id = slugify(target);
    const existing = byId.get(id);
    if (existing) {
      existing.millennium = true;
      continue;
    }
    push({
      id,
      title: target,
      wikipediaTitle: target,
      field: curated.field,
      fieldSource: 'curated',
      ...(curated.subfield ? { subfield: curated.subfield } : {}),
      status: 'open',
      depth: 1,
      millennium: true,
      relatedTopics: [],
    });
  }

  const problems = entries.sort((a, b) => {
    const fa = FIELD_ORDER.indexOf(a.field);
    const fb = FIELD_ORDER.indexOf(b.field);
    if (fa !== fb) return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb);
    return a.title.localeCompare(b.title);
  });

  const fields = [...new Set(problems.map((p) => p.field))];

  return {
    meta: {
      source: {
        page: SOURCE_PAGE.replace(/_/g, ' '),
        url: `https://en.wikipedia.org/wiki/${SOURCE_PAGE}`,
        revisionId: revid ?? null,
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
      generatedBy: 'scripts/build-dataset.mjs',
      generatedAt: new Date().toISOString().slice(0, 10),
      counts: {
        total: problems.length,
        open: problems.filter((p) => p.status === 'open').length,
        solved: problems.filter((p) => p.status === 'solved').length,
        millennium: problems.filter((p) => p.millennium).length,
        withDescription: problems.filter((p) => p.description).length,
        withReferences: problems.filter((p) => p.references).length,
      },
      fields: FIELD_ORDER.filter((f) => fields.includes(f)).concat(fields.filter((f) => !FIELD_ORDER.includes(f))),
    },
    problems,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const cacheIdx = process.argv.indexOf('--cache');
  const cachePath = cacheIdx > -1 ? process.argv[cacheIdx + 1] : null;

  let json;
  if (cachePath && existsSync(cachePath)) {
    console.log(`Using cached wikitext: ${cachePath}`);
    json = JSON.parse(readFileSync(cachePath, 'utf8'));
  } else {
    console.log(`Fetching ${API}`);
    const res = await fetch(API, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Wikipedia API returned HTTP ${res.status}`);
    json = await res.json();
  }

  const wikitext = json?.parse?.wikitext;
  if (typeof wikitext !== 'string') throw new Error('Unexpected API shape: no parse.wikitext');

  const dataset = parse(wikitext, json?.parse?.revid);

  const outPath = resolve(REPO, 'src/data/problems.generated.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(dataset, null, 1) + '\n', 'utf8');

  const byField = {};
  for (const p of dataset.problems) byField[p.field] = (byField[p.field] ?? 0) + 1;

  const c = dataset.meta.counts;
  console.log(`\nWrote ${outPath}`);
  console.log(`  source revision: ${dataset.meta.source.revisionId}`);
  console.log(`  ${c.total} problems  (${c.open} open, ${c.solved} solved, ${c.millennium} Millennium)`);
  console.log(`  ${c.withDescription} with a description, ${c.withReferences} with citations`);
  console.log('\nBy field:');
  for (const f of dataset.meta.fields) console.log(`  ${String(byField[f]).padStart(4)}  ${f}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

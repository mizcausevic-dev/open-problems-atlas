/**
 * build-glossary.mjs
 *
 * Emits dist/glossary/index.html and dist/glossary/<slug>/index.html.
 *
 * These pages deliberately DO NOT boot the single-page app, and that is the
 * whole design rather than a shortcut.
 *
 * Google indexes the post-JavaScript rendered DOM, not the HTML that was served.
 * src/lib/router.ts reads window.location.hash and nothing else, so an SPA
 * booted at /glossary/riemann-hypothesis/ parses an empty hash, resolves to the
 * Overview route, and React replaces the definition with the homepage. A
 * crawler would index the homepage under a glossary URL while a human saw the
 * same thing — content and URL disagreeing, with nothing throwing an error.
 *
 * Not booting the app also sidesteps `base: './'` in vite.config.ts, which would
 * resolve every asset against the nested path and 404, and removes any need to
 * touch the router. These pages are documents. They link into the app; they are
 * not part of it.
 *
 * Styling is a self-contained inline block rather than the app's stylesheet.
 * Tailwind generates classes by scanning source files and would not see markup
 * built inside this script, so importing the app CSS would ship a stylesheet
 * missing exactly the classes these pages use.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS, CATEGORIES } from '../src/data/glossary.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://openmathproblems.kineticgain.com';
const OUT = resolve(REPO, 'dist/glossary');

const dataset = JSON.parse(readFileSync(resolve(REPO, 'src/data/problems.generated.json'), 'utf8'));
const problemsById = new Map(dataset.problems.map((p) => [p.id, p]));

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const bySlug = new Map(TERMS.map((t) => [t.slug, t]));

/**
 * The theme bootstrap, byte-identical to the one in index.html.
 *
 * Identical matters: scripts/build-seo.mjs computes a sha256 of the inline
 * script in dist/index.html and pins script-src to it. A CSP hash matches any
 * element whose content hashes to that value, on any page, so these pages are
 * covered by the existing hash for free. One character of drift and the script
 * is blocked here and nowhere else, producing a light-mode flash on glossary
 * pages only, with the build still reporting success.
 */
const THEME_BOOTSTRAP = `
      // Applied before first paint so there is no light-mode flash on load.
      try {
        const saved = localStorage.getItem('opa.theme');
        const dark = saved ? saved === 'dark' : !window.matchMedia('(prefers-color-scheme: light)').matches;
        document.documentElement.classList.toggle('dark', dark);
      } catch { /* private mode: keep the default dark class */ }
    `;

const STYLE = `
    :root {
      --bg: #FBFBFC; --panel: #FFFFFF; --line: #E3E5E9;
      --ink: #3D4450; --ink-strong: #10131A; --ink-dim: #6B7280;
      --accent: #0E7C86; --accent-soft: #E6F4F5;
    }
    :root.dark {
      --bg: #0B0C10; --panel: #12151C; --line: #232833;
      --ink: #C5C6C7; --ink-strong: #F2F4F7; --ink-dim: #8A929F;
      --accent: #66FCF1; --accent-soft: #10262A;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--bg); color: var(--ink);
      font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 5rem; }
    a { color: var(--accent); }
    header.site { border-bottom: 1px solid var(--line); background: var(--panel); }
    header.site .wrap { padding: 0.9rem 1.25rem; display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
    header.site strong { color: var(--ink-strong); font-size: 0.95rem; }
    header.site a { text-decoration: none; font-size: 0.85rem; color: var(--ink-dim); }
    header.site a:hover { color: var(--ink-strong); }
    h1 { color: var(--ink-strong); font-size: 2rem; line-height: 1.2; margin: 1.5rem 0 0.5rem; letter-spacing: -0.02em; }
    h2 { color: var(--ink-strong); font-size: 1.05rem; margin: 2.25rem 0 0.75rem; letter-spacing: -0.01em; }
    .cat { display: inline-block; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase;
           color: var(--accent); background: var(--accent-soft); border-radius: 999px; padding: 0.2rem 0.6rem; }
    .lede { font-size: 1.05rem; color: var(--ink); }
    .note { border-left: 2px solid var(--line); padding-left: 1rem; color: var(--ink); margin: 1.25rem 0; }
    .note b { color: var(--ink-strong); display: block; font-size: 0.78rem; letter-spacing: 0.06em;
              text-transform: uppercase; margin-bottom: 0.35rem; font-weight: 600; }
    ul.terms { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
    ul.terms a { text-decoration: none; }
    ul.terms a:hover { text-decoration: underline; }
    ul.plain { padding-left: 1.1rem; margin: 0.5rem 0; }
    ul.plain li { margin: 0.25rem 0; }
    footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--line);
             font-size: 0.82rem; color: var(--ink-dim); }
    footer a { color: var(--ink-dim); }
    .back { font-size: 0.85rem; color: var(--ink-dim); text-decoration: none; }
    .back:hover { color: var(--ink-strong); }
`;

/** `canonicalPath` must start and end with a slash. */
function page({ title, description, canonicalPath, body, jsonLd }) {
  return `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#0B0C10" />
    <link rel="canonical" href="${SITE}${canonicalPath}" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${SITE}${canonicalPath}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <script>${THEME_BOOTSTRAP}</script>
    <style>${STYLE}</style>
  </head>
  <body>
    <header class="site">
      <div class="wrap">
        <strong>Open Problems Atlas</strong>
        <a href="/">Atlas</a>
        <a href="/glossary/">Glossary</a>
        <a href="/#/lab">Lab</a>
        <a href="/#/about">About</a>
      </div>
    </header>
    <main class="wrap">
${body}
      <footer>
        <p>
          Definitions written for this site. Problem data is derived from Wikipedia's
          <a href="${esc(dataset.meta.source.url)}">List of unsolved problems in mathematics</a>,
          revision ${dataset.meta.source.revisionId}, under
          <a href="${esc(dataset.meta.source.licenseUrl)}">CC BY-SA 4.0</a>.
        </p>
      </footer>
    </main>
${jsonLd ? `    <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>\n` : ''}  </body>
</html>
`;
}

// --------------------------------------------------------------- index page

const indexBody = [
  '      <h1>Glossary</h1>',
  `      <p class="lede">${TERMS.length} terms used across this atlas, defined precisely. Each entry states what the term means and then the condition people leave out, because a definition that is almost right is the kind that costs you an afternoon.</p>`,
  ...CATEGORIES.map((cat) => {
    const inCat = TERMS.filter((t) => t.category === cat).sort((a, b) => a.term.localeCompare(b.term));
    return [
      `      <h2 id="${esc(cat.toLowerCase().replace(/\s+/g, '-'))}">${esc(cat)}</h2>`,
      '      <ul class="terms">',
      ...inCat.map(
        (t) =>
          `        <li><a href="/glossary/${t.slug}/">${esc(t.term)}</a> <span style="color:var(--ink-dim)">— ${esc(
            t.definition.replace(/\.$/, '').slice(0, 96),
          )}…</span></li>`,
      ),
      '      </ul>',
    ].join('\n');
  }),
].join('\n');

mkdirSync(OUT, { recursive: true });
writeFileSync(
  resolve(OUT, 'index.html'),
  page({
    title: 'Glossary — Open Problems Atlas',
    description: `Precise definitions of ${TERMS.length} terms from number theory, topology, logic, graph theory and complexity, each with the condition that is usually omitted.`,
    canonicalPath: '/glossary/',
    body: indexBody,
    /**
     * DefinedTermSet is valid schema.org but is NOT a Google rich result — it
     * appears nowhere in Google's structured data gallery. It is here for
     * machine-readability and costs nothing; it is not an SEO feature and
     * should not be counted as one.
     */
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'Open Problems Atlas glossary',
      url: `${SITE}/glossary/`,
      hasDefinedTerm: TERMS.map((t) => ({
        '@type': 'DefinedTerm',
        name: t.term,
        description: t.definition,
        url: `${SITE}/glossary/${t.slug}/`,
      })),
    },
  }),
  'utf8',
);

// ---------------------------------------------------------------- term pages

for (const t of TERMS) {
  const seeAlso = t.seeAlso.map((s) => bySlug.get(s)).filter(Boolean);
  const problems = t.problems.map((id) => problemsById.get(id)).filter(Boolean);

  const body = [
    '      <a class="back" href="/glossary/">← Glossary</a>',
    `      <h1>${esc(t.term)}</h1>`,
    `      <p><span class="cat">${esc(t.category)}</span></p>`,
    `      <p class="lede">${esc(t.definition)}</p>`,
    '      <div class="note"><b>What is usually left out</b>',
    `        <p>${esc(t.note)}</p>`,
    '      </div>',
    seeAlso.length
      ? [
          '      <h2>Related terms</h2>',
          '      <ul class="plain">',
          ...seeAlso.map((r) => `        <li><a href="/glossary/${r.slug}/">${esc(r.term)}</a></li>`),
          '      </ul>',
        ].join('\n')
      : '',
    problems.length
      ? [
          '      <h2>In the atlas</h2>',
          '      <ul class="plain">',
          ...problems.map(
            (p) =>
              `        <li><a href="/#/p/${esc(p.id)}">${esc(p.title)}</a> <span style="color:var(--ink-dim)">— ${esc(
                p.field,
              )}, ${esc(p.status === 'partially-solved' ? 'partially solved' : p.status)}</span></li>`,
          ),
          '      </ul>',
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  mkdirSync(resolve(OUT, t.slug), { recursive: true });
  writeFileSync(
    resolve(OUT, t.slug, 'index.html'),
    page({
      title: `${t.term} — Glossary | Open Problems Atlas`,
      // The definition is the description. It is written to be a standalone
      // sentence, so there is nothing to gain from composing a second one that
      // says the same thing less precisely.
      description: t.definition,
      canonicalPath: `/glossary/${t.slug}/`,
      body,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        name: t.term,
        description: t.definition,
        url: `${SITE}/glossary/${t.slug}/`,
        inDefinedTermSet: `${SITE}/glossary/`,
      },
    }),
    'utf8',
  );
}

console.log(`Glossary: ${TERMS.length} term pages + index written to dist/glossary/`);

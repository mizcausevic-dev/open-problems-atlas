/**
 * build-quiz.mjs
 *
 * Emits dist/quiz/index.html and dist/quiz/<deck>/index.html.
 *
 * No JavaScript, and that is not a limitation being worked around. Reveal is
 * done with <details>/<summary>, which is native, keyboard-operable, announced
 * correctly by screen readers, and works with scripting disabled. It also keeps
 * every answer and explanation in the served HTML, which a JS flip-card would
 * not — and crawlable answer text is the entire reason to publish a quiz as
 * pages rather than as a widget.
 *
 * Avoiding script has a second benefit here. scripts/build-seo.mjs pins
 * script-src to the sha256 of exactly one inline script; a second distinct
 * inline script on these pages would be blocked at runtime with only a console
 * error to show for it.
 *
 * Structured data note. Practice Problems markup is NOT emitted: Google
 * deprecated that feature in November 2025 and removed it from Search in
 * January 2026, so it would be markup for a rich result that no longer exists.
 * Quiz with eduQuestionType "Flashcard" is emitted, because the Education Q&A
 * feature it feeds is current — while noting it is limited to education queries
 * in a short list of languages, so it is worth having and not worth counting on.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECKS, balancedOptions } from '../src/data/quiz.mjs';
import { TERMS } from '../src/data/glossary.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://openmathproblems.kineticgain.com';
const OUT = resolve(REPO, 'dist/quiz');

const dataset = JSON.parse(readFileSync(resolve(REPO, 'src/data/problems.generated.json'), 'utf8'));
const termBySlug = new Map(TERMS.map((t) => [t.slug, t]));

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const LETTERS = ['A', 'B', 'C', 'D'];

/** Byte-identical to index.html's, so the existing CSP hash covers these pages. */
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
      --bg: #FBFBFC; --panel: #FFFFFF; --panel2: #F4F5F7; --line: #E3E5E9;
      --ink: #3D4450; --ink-strong: #10131A; --ink-dim: #6B7280;
      --accent: #0E7C86; --accent-soft: #E6F4F5; --ok: #0F766E;
    }
    :root.dark {
      --bg: #0B0C10; --panel: #12151C; --panel2: #171B23; --line: #232833;
      --ink: #C5C6C7; --ink-strong: #F2F4F7; --ink-dim: #8A929F;
      --accent: #66FCF1; --accent-soft: #10262A; --ok: #45A29E;
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
    h2 { color: var(--ink-strong); font-size: 1.05rem; margin: 2.25rem 0 0.75rem; }
    .lede { font-size: 1.05rem; }
    .back { font-size: 0.85rem; color: var(--ink-dim); text-decoration: none; }
    .back:hover { color: var(--ink-strong); }
    ol.qs { list-style: none; counter-reset: q; padding: 0; margin: 2rem 0 0; }
    ol.qs > li {
      counter-increment: q; border: 1px solid var(--line); background: var(--panel);
      border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 1rem;
    }
    .stem { color: var(--ink-strong); font-weight: 600; margin: 0 0 0.75rem; }
    .stem::before { content: counter(q) ". "; color: var(--ink-dim); font-weight: 500; }
    ul.opts { list-style: none; padding: 0; margin: 0 0 0.75rem; display: grid; gap: 0.3rem; }
    ul.opts li { background: var(--panel2); border: 1px solid transparent; border-radius: 8px; padding: 0.45rem 0.7rem; }
    ul.opts b { color: var(--ink-dim); font-weight: 600; margin-right: 0.4rem; }
    details { border-top: 1px solid var(--line); padding-top: 0.7rem; }
    summary { cursor: pointer; color: var(--accent); font-size: 0.88rem; font-weight: 600; }
    summary::marker { color: var(--ink-dim); }
    .ans { color: var(--ok); font-weight: 600; margin: 0.6rem 0 0.35rem; }
    .why { margin: 0; font-size: 0.94rem; }
    .why a { text-decoration: none; border-bottom: 1px dotted currentColor; }
    ul.decks { list-style: none; padding: 0; margin: 1.5rem 0 0; display: grid; gap: 0.75rem; }
    ul.decks li { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 1rem 1.15rem; }
    ul.decks a { text-decoration: none; font-weight: 600; font-size: 1.02rem; }
    ul.decks p { margin: 0.3rem 0 0; font-size: 0.9rem; color: var(--ink-dim); }
    footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--line);
             font-size: 0.82rem; color: var(--ink-dim); }
    footer a { color: var(--ink-dim); }
`;

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
        <a href="/quiz/">Quiz</a>
        <a href="/#/lab">Lab</a>
        <a href="/#/about">About</a>
      </div>
    </header>
    <main class="wrap">
${body}
      <footer>
        <p>
          Questions written for this site and drawn from its
          <a href="/glossary/">glossary</a>. Problem data is derived from Wikipedia's
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

const totalQuestions = DECKS.reduce((n, d) => n + d.questions.length, 0);

// ---------------------------------------------------------------- index page

mkdirSync(OUT, { recursive: true });
writeFileSync(
  resolve(OUT, 'index.html'),
  page({
    title: 'Quiz — Open Problems Atlas',
    description: `${totalQuestions} questions across ${DECKS.length} decks on unsolved mathematics, each with a worked explanation and a link to the glossary entry it comes from.`,
    canonicalPath: '/quiz/',
    body: [
      '      <h1>Quiz</h1>',
      `      <p class="lede">${totalQuestions} questions across ${DECKS.length} decks. Every answer is explained and linked back to the glossary entry it comes from, so a wrong guess is worth as much as a right one.</p>`,
      '      <p style="color:var(--ink-dim);font-size:0.92rem">Answers are hidden behind a control on each question, not by scripting. Nothing here needs JavaScript.</p>',
      '      <ul class="decks">',
      ...DECKS.map(
        (d) =>
          `        <li><a href="/quiz/${d.slug}/">${esc(d.title)}</a> <span style="color:var(--ink-dim)">· ${
            d.questions.length
          } questions</span><p>${esc(d.blurb)}</p></li>`,
      ),
      '      </ul>',
    ].join('\n'),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Open Problems Atlas quiz',
      url: `${SITE}/quiz/`,
      hasPart: DECKS.map((d) => ({
        '@type': 'Quiz',
        name: d.title,
        url: `${SITE}/quiz/${d.slug}/`,
      })),
    },
  }),
  'utf8',
);

// ---------------------------------------------------------------- deck pages

/**
 * Counts across ALL decks, not within each one.
 *
 * Restarting the index per deck left the rendered spread at A:13 B:13 C:9 D:7,
 * because the decks have 7, 10, 6, 6, 6 and 7 questions and none of those is a
 * multiple of four, so the remainders compound. A single running counter over
 * all 42 gives 11/11/10/10, and it matches how quiz.test.ts measures the
 * distribution — a test that indexes differently from the generator is
 * measuring something that never ships.
 */
let questionIndex = 0;

for (const deck of DECKS) {
  const rendered = deck.questions.map((q) => ({ q, ...balancedOptions(q, questionIndex++ % 4) }));

  const body = [
    '      <a class="back" href="/quiz/">← All decks</a>',
    `      <h1>${esc(deck.title)}</h1>`,
    `      <p class="lede">${esc(deck.blurb)}</p>`,
    `      <p style="color:var(--ink-dim);font-size:0.92rem">${deck.questions.length} questions. Reveal each answer when you have committed to one.</p>`,
    '      <ol class="qs">',
    ...rendered.map(({ q, options, answer }) => {
      const term = termBySlug.get(q.term);
      return [
        '        <li>',
        `          <p class="stem">${esc(q.q)}</p>`,
        '          <ul class="opts">',
        ...options.map((o, j) => `            <li><b>${LETTERS[j]}</b>${esc(o)}</li>`),
        '          </ul>',
        '          <details>',
        '            <summary>Show the answer</summary>',
        `            <p class="ans">${LETTERS[answer]}. ${esc(options[answer])}</p>`,
        `            <p class="why">${esc(q.why)}${
          term
            ? ` <a href="/glossary/${term.slug}/">More on ${esc(term.term.toLowerCase())}</a>.`
            : ''
        }</p>`,
        '          </details>',
        '        </li>',
      ].join('\n');
    }),
    '      </ol>',
  ].join('\n');

  mkdirSync(resolve(OUT, deck.slug), { recursive: true });
  writeFileSync(
    resolve(OUT, deck.slug, 'index.html'),
    page({
      title: `${deck.title} quiz — Open Problems Atlas`,
      description: deck.blurb,
      canonicalPath: `/quiz/${deck.slug}/`,
      body,
      /**
       * eduQuestionType "Flashcard" is required by Google's Education Q&A
       * feature. The answer text carries the explanation too, since a flashcard
       * back that says only "B" teaches nothing.
       */
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Quiz',
        name: `${deck.title} quiz`,
        url: `${SITE}/quiz/${deck.slug}/`,
        about: { '@type': 'Thing', name: deck.title },
        educationalLevel: 'beginner',
        educationalAlignment: [
          {
            '@type': 'AlignmentObject',
            alignmentType: 'educationalSubject',
            targetName: 'Mathematics',
          },
        ],
        hasPart: rendered.map(({ q, options, answer }) => ({
          '@type': 'Question',
          eduQuestionType: 'Flashcard',
          learningResourceType: 'Practice problem',
          name: q.q,
          text: q.q,
          acceptedAnswer: { '@type': 'Answer', text: `${options[answer]}. ${q.why}` },
        })),
      },
    }),
    'utf8',
  );
}

console.log(`Quiz: ${DECKS.length} deck pages + index (${totalQuestions} questions) written to dist/quiz/`);

/**
 * build-seo.mjs
 *
 * Generates dist/sitemap.xml and dist/robots.txt after the build.
 *
 * The sitemap lists the app once and each glossary page individually. The app
 * uses hash routing, so `#/p/riemann-hypothesis` is not a separate URL —
 * crawlers strip fragments, and listing them would be listing the same page 591
 * times. The glossary pages are static documents at real paths, so they are
 * listed one by one. See the note above `glossaryUrls` for why the problems are
 * not treated the same way.
 *
 * lastmod is the date the DATASET was generated, not the wall clock. A build
 * timestamp would claim the content changed every time the CSS did. The dataset
 * date is a fact about the source; `new Date()` is a fact about the machine.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS } from '../src/data/glossary.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://openmathproblems.kineticgain.com';

const dataset = JSON.parse(readFileSync(resolve(REPO, 'src/data/problems.generated.json'), 'utf8'));
const lastmod = dataset.meta.generatedAt;
const revision = dataset.meta.source.revisionId;

/**
 * The sitemap lists the application once and every glossary page individually,
 * and the asymmetry is the decision rather than an oversight.
 *
 * The app is hash-routed, so #/p/<id> is not a separate URL — crawlers discard
 * fragments, and listing 591 of them would be listing the same document 591
 * times. The glossary pages are real paths serving real documents, so they are
 * listed. Prerendering the 591 problems to paths as well was considered and
 * refused: the median problem's own statement is 68 characters and 122 have
 * none, which is a few hundred thin pages. A written definition is not.
 */
const glossaryUrls = TERMS.map(
  (t) => `  <url>
    <loc>${SITE}/glossary/${t.slug}/</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  The application is one entry: it is a hash-routed single-page app, every view
  is served by that one document, and fragments are not separate URLs.
  The glossary pages below are static documents at real paths, one per term.
  lastmod is the date the underlying dataset was generated from Wikipedia
  revision ${revision}, not the date this file was built.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
  </url>
  <url>
    <loc>${SITE}/glossary/</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
${glossaryUrls}
</urlset>
`;

/**
 * AI crawlers are allowed explicitly rather than by the absence of a rule.
 *
 * The code is MIT and the data is CC BY-SA, so this project wants to be read and
 * cited. Saying so out loud is more useful than a 404 that a crawler has to
 * interpret, and it makes the intent reviewable.
 */
const robots = `# https://openmathproblems.kineticgain.com/
#
# Everything here is public. The software is MIT; the problem data and article
# extracts are from Wikipedia under CC BY-SA 4.0 and must keep that licence.
# See ${SITE}/#/about and the repository's LICENSE-DATA.md.
#
# Note for crawlers that do not execute JavaScript: the application at / is
# client-rendered, and its served HTML carries a static summary of the dataset
# rather than the full interface. The glossary under /glossary/ is different —
# those are plain static documents with no JavaScript at all, and what is served
# is exactly what a browser displays.

User-agent: *
Allow: /

# Explicitly welcome. Citation is the point.
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

# /assets/ is deliberately NOT disallowed. It holds the JS and CSS, and a
# crawler that renders JavaScript needs both to see the application at all.
# Blocking them would leave Google with only the prerendered summary while
# reporting the page's resources as unfetchable, which looks like cloaking and
# is a worse outcome than the crawl budget it would save.

Sitemap: ${SITE}/sitemap.xml
`;

/**
 * security.txt (RFC 9116).
 *
 * Expires is derived from the dataset date rather than typed, for the same
 * reason lastmod is. RFC 9116 requires the field and treats an expired file as
 * stale, so a hand-typed date is a dead man's switch nobody remembers to reset.
 * Tying it to the build means it refreshes whenever the site is redeployed and
 * genuinely goes stale if the site is abandoned, which is what the field is for.
 */
const expires = new Date(`${lastmod}T00:00:00Z`);
expires.setUTCFullYear(expires.getUTCFullYear() + 1);

const securityTxt = `# Reporting a vulnerability in Open Problems Atlas.
#
# This is a static site with no backend, no accounts and no server-side code.
# The surface worth reporting is the browser-side encrypted journal, the
# expression evaluator, or anything that misrepresents the data's source.
# See ${SITE}/#/about and SECURITY.md in the repository.

Contact: https://github.com/mizcausevic-dev/open-problems-atlas/security/advisories/new
Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}
Preferred-Languages: en
Canonical: ${SITE}/.well-known/security.txt
Policy: https://github.com/mizcausevic-dev/open-problems-atlas/blob/main/SECURITY.md
`;

mkdirSync(resolve(REPO, 'dist/.well-known'), { recursive: true });
writeFileSync(resolve(REPO, 'dist/.well-known/security.txt'), securityTxt, 'utf8');
writeFileSync(resolve(REPO, 'dist/sitemap.xml'), sitemap, 'utf8');
writeFileSync(resolve(REPO, 'dist/robots.txt'), robots, 'utf8');

console.log(
  `SEO: sitemap.xml (${TERMS.length + 2} urls: app, glossary index, ${TERMS.length} terms; lastmod ${lastmod}), robots.txt, security.txt written`,
);

// ---------------------------------------------------------------------------
// Content-Security-Policy: replace script-src 'unsafe-inline' with a hash.
//
// The .htaccess comment describes the policy as "deliberately tight" and says it
// "breaks first" if the app's behaviour changes. With 'unsafe-inline' in
// script-src that was not true: the directive's XSS value was close to zero, on
// the one page in this estate that derives an AES key from a passphrase and
// holds decrypted notes in memory. An untrue comment about a security control is
// worse than no comment.
//
// index.html contains exactly one inline script — the theme bootstrap that
// prevents a light-mode flash. Hashing it is enough; nothing else is inline.
// style-src keeps 'unsafe-inline' deliberately: Tailwind and motion both inject
// inline styles, and style-src is a materially lower-risk directive. That
// asymmetry is a decision, not an oversight.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prerendered summary, generated from the dataset.
//
// This is the whole answer to "the site is invisible to anything that does not
// run JavaScript". It is NOT an attempt to rank 591 problem pages: the median
// problem's own statement in the source article is 68 characters and 122 have
// none at all, so prerendering them individually would produce hundreds of thin
// pages. One accurate document describing one dataset is what this actually is.
//
// Every number below is read from the dataset, never typed. A literal count in
// a template is a claim that silently expires.
// ---------------------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const problems = dataset.problems;
const byStatus = problems.reduce((a, p) => ({ ...a, [p.status]: (a[p.status] ?? 0) + 1 }), {});
const byField = [...problems.reduce((m, p) => m.set(p.field, (m.get(p.field) ?? 0) + 1), new Map())].sort(
  (a, b) => b[1] - a[1],
);
const millennium = problems.filter((p) => p.millennium);

const prerender = `
<main>
  <h1>Open Problems Atlas</h1>
  <p>
    Every problem listed in Wikipedia's
    <a href="${esc(dataset.meta.source.url)}">List of unsolved problems in mathematics</a>,
    parsed into a structured dataset from revision ${revision} and browsable offline.
    ${problems.length} problems in total: ${byStatus.open ?? 0} still open,
    ${byStatus.solved ?? 0} solved, ${byStatus['partially-solved'] ?? 0} partially solved.
  </p>
  <p>
    The application also provides a research journal encrypted in the browser with AES-256-GCM,
    and an interactive laboratory that computes rather than asserts: Collatz orbits, a sieve of
    Eratosthenes with Goldbach decompositions, the Riemann-Siegel Z function with its zeros located
    by bisection, Robin's inequality, arithmetic functions, a plotter, and the covering set behind
    Sierpinski's 78,557. There are no accounts, no tracking, and no server.
  </p>

  <h2>Problems by field</h2>
  <ul>
${byField.map(([f, n]) => `    <li>${esc(f)}: ${n}</li>`).join('\n')}
  </ul>

  <h2>Millennium Prize Problems in this dataset</h2>
  <ul>
${millennium.map((p) => `    <li>${esc(p.title)}</li>`).join('\n')}
  </ul>

  <h2>Source and licence</h2>
  <p>
    Problem data and article extracts are derived from the English Wikipedia and are licensed
    <a href="${esc(dataset.meta.source.licenseUrl)}">CC BY-SA 4.0</a>, the same licence as the source.
    The exact revision used is recorded as ${revision} so the snapshot can be checked against the
    original. The software itself is MIT licensed and the source is public.
  </p>
  <p>This page requires JavaScript for the interactive views. The summary above does not.</p>
</main>
<script type="application/ld+json">
${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: 'Open Problems Atlas dataset',
        description: `Structured records for ${problems.length} problems from Wikipedia's List of unsolved problems in mathematics, ${byStatus.open ?? 0} of them still open, with field, status, source revision and provenance for each.`,
        url: `${SITE}/`,
        license: dataset.meta.source.licenseUrl,
        isBasedOn: dataset.meta.source.url,
        // Organization, not Person. There is no bio'd, credentialed human author
        // here — the content is brand voice, and a Person byline over it would be
        // a fabricated authorship signal.
        creator: { '@type': 'Organization', name: 'Kinetic Gain', url: 'https://kineticgain.com' },
        dateModified: lastmod,
        keywords: byField.map(([f]) => f),
      },
      {
        '@type': 'WebApplication',
        name: 'Open Problems Atlas',
        url: `${SITE}/`,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any browser',
        // Free and no accounts, stated as structured data because it is the
        // question most often asked of a tool like this.
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isAccessibleForFree: true,
      },
    ],
  },
  null,
  2,
)}
</script>
`.trim();

let html = readFileSync(resolve(REPO, 'dist/index.html'), 'utf8');

if (!html.includes('<!--__PRERENDER__-->')) {
  console.error('SEO: prerender marker missing from dist/index.html; the shell would ship empty.');
  process.exit(1);
}

// A replacer FUNCTION, not a replacement string.
//
// String.replace treats `$&`, `` $` ``, `$'` and `$$` as special inside the
// replacement even when the pattern is a plain string. The prerender block is
// built from dataset text, 129 of the 591 descriptions contain `$` (KaTeX
// delimiters), and one contains the sequence `$K$'s` — `$'` expands to
// everything after the match, which would silently duplicate the tail of the
// document into the page. A function replacement disables all of that.
html = html.replace('<!--__PRERENDER__-->', () => prerender);
writeFileSync(resolve(REPO, 'dist/index.html'), html, 'utf8');
console.log(
  `SEO: prerendered ${problems.length} problems across ${byField.length} fields into the root document`,
);

/**
 * Only scripts the browser will actually execute need a hash.
 *
 * The JSON-LD block above is a <script> element but carries a data MIME type, so
 * it is never prepared as script and script-src does not gate it. Hashing it
 * would be harmless but misleading: the policy would list a digest for something
 * that was never going to run, and a later reader would reasonably conclude the
 * page has two executable inline scripts when it has one.
 */
const JS_TYPES = /^(text\/javascript|application\/javascript|module)$/i;

const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((m) => {
    const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
    return !type || JS_TYPES.test(type[1]);
  })
  .map((m) => m[2]);

if (inline.length === 0) {
  console.error('CSP: no inline script found in dist/index.html; refusing to guess.');
  process.exit(1);
}

const hashes = inline.map((code) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`);

const htaccessPath = resolve(REPO, 'dist/.htaccess');
const htaccess = readFileSync(htaccessPath, 'utf8');
const before = "script-src 'self' 'unsafe-inline'";

if (!htaccess.includes(before)) {
  console.error(`CSP: expected "${before}" in dist/.htaccess; refusing to write a policy I cannot verify.`);
  process.exit(1);
}

writeFileSync(htaccessPath, htaccess.replace(before, `script-src 'self' ${hashes.join(' ')}`), 'utf8');
console.log(`CSP: script-src pinned to ${hashes.length} inline hash(es); 'unsafe-inline' removed`);

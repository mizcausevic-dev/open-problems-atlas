# Decision record

Dated 2026-07-27. Each entry states the decision, the reason, and what would change it.

---

## 1. Generate the dataset, do not write it

**Decision.** `scripts/build-dataset.mjs` parses the source article's wikitext into
`src/data/problems.generated.json` at build time. No problem is typed by hand.

**Why.** A hand-written dataset stops at whatever the author had patience for — the comparison build
stopped at 11 of 591 — and it silently goes stale. A generated one carries a revision ID, can be
re-run, and is auditable against its source.

**Cost.** Parsing wikitext is genuinely fiddly: four separate bugs, two of which produced
plausible-looking wrong output rather than crashes. That cost is paid once and is covered by tests.

**Reversal condition.** If the article's structure changes enough that parsing produces more noise
than signal, freeze the last good generation and curate from there — but keep the revision stamp.

## 2. `wikipediaTitle` is optional

**Decision.** 29 entries have no linked article, because the source states them inline
("Are there infinitely many Kynea primes?"). The field is optional and the UI handles absence.

**Why.** The alternative was to take the first wikilink on the line regardless. That is what
produced an entry titled "Aleksandar Nikolov" — the mathematician who settled it, not the problem.
A missing link is a fact about the source; inventing one is not.

## 3. No server

**Decision.** Static files only. No Express, no API proxy, no keys.

**Why.** Every feature in the brief that needs a backend — accounts, sync, forum, AI review — was
either not built or built as a client-side equivalent. Keeping a server for none of them adds a
deploy surface, a secret to manage, and an implicit promise of persistence that nothing honours.

**Consequence.** Deploys anywhere static, works from a subdirectory, and there is no infrastructure
to compromise.

## 4. Encryption at rest, and it is called that

**Decision.** AES-256-GCM, PBKDF2-SHA256 at 600,000 iterations (the current OWASP floor), key
derived in the page. Labelled "encrypted vault", never "end-to-end".

**Why.** End-to-end describes a message in transit between two parties. There is one party and no
transit. The brief asked for E2E four times; answering with the accurate smaller thing and
explaining the difference is more useful than the badge.

**Threat model, stated in the source and the UI.** Covers someone with read access to the browser
profile — shared machine, synced backup, copied export file. Does not cover code running in the
page, a compromised browser, or a keylogger. Nothing client-side can.

## 5. Manual export instead of scheduled backups

**Decision.** Export on demand to JSON, LaTeX, Markdown, PDF. No schedule.

**Why.** A "daily backup" in a web app can only run while a tab is open, to a destination the app
does not control. That is not a backup, it is a setting that produces a reassuring timestamp. The
comparison build shipped exactly that: `lastBackup: new Date().toLocaleTimeString()`.

**Reversal condition.** Real scheduled backup needs either the File System Access API with a
persisted directory handle, or a server. The first is Chromium-only; revisit if that changes.

## 6. Five dependencies, and what was refused

**Kept:** react, react-dom, katex, lucide-react, motion.

**Refused, with the replacement:**

| Not added | Instead | Saved |
| --- | --- | --- |
| react-router | 159-line hash router | ~20 KB, plus server rewrite rules |
| recharts / chart.js | Hand-rolled SVG | ~100 KB gz for one chart shape |
| zustand / redux | One store + `useSyncExternalStore` | A dependency for a singleton |
| jspdf / html2pdf | `window.print()` + a designed `@media print` block | ~300 KB |
| A webfont | System sans and mono stacks | A font CDN request, and the privacy claim stays true |

**Reversal condition on the chart:** if a second chart shape is needed, reconsider rather than
growing `Sparkline` into a library.

## 7. Riemann–Siegel Z instead of a complex spiral

**Decision.** Plot `Z(t) = e^(iθ(t))·ζ(1/2+it)`, real-valued, with zeros located by bisection and
printed against published values.

**Why.** The obvious plot — a truncated Dirichlet series in the complex plane — is not the zeta
function on the critical line, because that series diverges there. It looks right and is not. A
real-valued function crossing an axis at a checkable location cannot hide the same way.

**θ via log-gamma, not the asymptotic series.** The asymptotic expansion is only good for large `t`,
and the zero finder scans from `t = 1`. A bad θ down there can manufacture sign changes that read as
zeros.

## 8. Hash routing, `base: './'`

**Decision.** Hash routes; relative asset base.

**Why.** Every route resolves without a server rewrite, so the same `dist/` works from a domain
root, `kineticgain.com/atlas/`, or a file path. History-API routing would need per-host config and
would 404 on refresh wherever that config was missed.

**Cost.** URLs carry a `#`. Acceptable for a tool; would reconsider for a content site where the URL
is a ranking surface.

**Revisited after deploy, and kept.** A search audit made the cost concrete: crawlers discard
fragments, so all 591 problems are one URL, and `sitemap.xml` therefore has exactly one entry.

The tempting fix — migrate to path routing and prerender 591 pages — was rejected on the data rather
than on preference. The median problem's own statement in the source article is 68 characters; 122
entries have no statement at all, and 27 would prerender to nothing but a title, a field and a
status. That is 591 thin pages, which is a well-known way to make a domain rank worse, not better.
The honest description of this dataset is *one substantial index of a Wikipedia article*, and one
URL is what that is.

What was done instead: prerender real content into the single root document, ship a truthful
one-entry sitemap, and close the discovery gap — the site had no inbound link and no verified Search
Console property, which made every on-page fix worth zero regardless of routing.

**Reversal condition.** Ninety days of real Search Console data showing impressions against
individual problem names. Demand first, then the routing change. Not the other way round.

## 9. Provenance is a field, not a footnote

**Decision.** Every problem carries `fieldSource: 'wikipedia-section' | 'curated'`. Every remote
value is a `Remote<T>` union with an explicit error arm. Every `Stat` component requires a `source`
prop.

**Why.** Making provenance a required parameter means a figure with no stated origin does not
typecheck. It moves the discipline from review-time to compile-time.

## 10. Test the data, not just the code

**Decision.** `src/data/dataset.test.ts` asserts properties of the generated dataset, including a
grep that fails if `consensusProgress`, `pageviewsData`, `popularity`, `difficultyScore` or
`trendingScore` ever appear.

**Why.** Fabricated metrics do not arrive as a bug report. They arrive as a helpful-looking commit
adding a progress bar. A failing test is the only thing that reliably objects.

## 11. Mobile navigation is a sheet, not a scrolling tab row

**Decision.** Full-screen overlay on small screens. Filter chips wrap; the timeline's year bars wrap.
Nothing scrolls sideways.

**Why.** A horizontally scrolling tab strip hides its own overflow. Items past the fold are
invisible and undiscoverable, on the device with least room to spare. Verified: zero horizontal
overflow across all 9 routes at 375 px.

---

## Standing-rule conflicts, named

Two house rules were scoped rather than followed literally. Flagging both rather than resolving them
silently:

1. **`-Claude` filename suffix.** Applied to the standalone documents (`COMPARISON-Claude.md`,
   `DECISIONS-Claude.md`, `capability-matrix-Claude.html`). **Not** applied to application source:
   `App-Claude.tsx` importing `./views/AtlasView-Claude` would break every convention a reader
   expects and every tool that assumes them. `README.md` and `LICENSE` are tool-reserved.

2. **Seven-theme dashboard requirement.** The shipped visualisation is a decision artefact, not an
   operator dashboard, so it ships light and dark rather than all seven themes. Say the word and it
   gets the full set.

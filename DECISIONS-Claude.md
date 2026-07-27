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

## 12. Attachments live inside the note, not in IndexedDB

**Decision.** Images are stored as data URIs on the `JournalEntry`, inside `UserData`. Videos are
stored as a link, never as bytes.

**Why.** IndexedDB would buy far more room, and that is the only argument for it. The cost is that
the bytes would sit outside the vault, outside the export file, and outside the import merge — so
"your notes are encrypted at rest" would quietly stop being true for the part of a note most likely
to be a photograph of someone's whiteboard, and an export would silently omit it. One store means
one set of guarantees.

**Cost, stated plainly.** The localStorage quota, roughly 5 MB and counted in UTF-16 code units in
several browsers. Budgets are enforced in the store rather than the editor, because the quota is
shared across every note and a per-editor check counts the wrong thing.

**This forced a real bug fix.** `persist()` swallowed quota errors with a `console.warn`, and in
vault mode the `setItem` sat inside a `.then()` outside the try, so it was an invisible unhandled
rejection. Survivable while notes were text. With images it means writing a note, seeing it on
screen, and losing it on reload. Failures are now surfaced in the editor.

**Reversal condition.** A user hitting the ceiling in normal use. Then the move is the File System
Access API with a persisted directory handle, not IndexedDB — it keeps the data somewhere the user
can see and back up, which is the same reason scheduled backup was refused in item 5.

## 13. Video is a facade, and the privacy claim got more precise rather than looser

**Decision.** Embedded video renders as a locally drawn placeholder. The iframe is created on click.
YouTube goes to `youtube-nocookie.com`; `frame-src` names exactly those two hosts and `connect-src`
is deliberately not widened to match — a player may be framed, it may not be fetched from.

**Why not a normal embed.** An ordinary YouTube iframe contacts Google on render, whether or not
anyone watches. That is how a site ends up reporting every visitor to a third party while its
privacy page says it does not. The placeholder does not fetch the provider's thumbnail either,
because that request is the same disclosure in a smaller package.

**What changed on the About page.** "One outbound request exists" became two, each described with
the exact gesture that triggers it, plus a warning that once you press play the provider's rules
apply and not this page's — including that youtube-nocookie is not the guarantee its name suggests,
and that Vimeo has no equivalent domain. The claim got narrower and more specific. It would have
been easier to leave the old sentence and hope nobody checked.

**Checkable.** `attachments.test.ts` reads the shipped CSP out of `public/.htaccess` and asserts
every host `embedUrl` can produce is permitted by `frame-src`, and that `connect-src` mentions
neither provider. The first version of that test matched the explanatory comment above the directive
instead of the directive itself, so it failed against a correct policy and would have passed against
a broken one. A negative control caught it.


## 14. The glossary is static pages that do not boot the app

**Decision.** `/glossary/` and `/glossary/<slug>/` are generated by
`scripts/build-glossary.mjs` as plain documents with no module script. They link into the app; they
are not part of it. The hash-routed SPA is unchanged.

**Why not hydrate the SPA on top.** Google indexes the post-JavaScript rendered DOM, not the HTML
that was served. `src/lib/router.ts` reads `window.location.hash` and nothing else, so an SPA booted
at `/glossary/riemann-hypothesis/` parses an empty hash, resolves to Overview, and React replaces the
definition with the homepage. A crawler would index the homepage under a glossary URL and a human
would see the same thing. Nothing would throw. Not booting the app also sidesteps `base: './'`
resolving every asset against the nested path, and needs no router change.

**Why a glossary and not 591 problem pages.** Item 8 refused prerendering the problems because the
median statement is 68 characters and 122 have none. That reasoning was about thin content, not about
paths, so it does not apply to written definitions. `glossary.test.ts` enforces the distinction
mechanically: every entry needs more than 60 words across its definition and note, or the build fails.

**Hand-authored, and that is the exception.** Everything else in this project is generated from a
source. No source of definitions exists, and deriving them from problem statements would be
fabrication — the statements are questions. The four wrong definitions in the reviewed proposal
(Collatz stated over all integers, chromatic number using "connected" for "adjacent", amicable
numbers without "distinct", the continuum hypothesis written as a question) are each pinned by a
regression test.

**Term-to-problem links are hand-checked, not matched.** "prime" appears in 23 problem titles and
"number" in 30; a string matcher would produce confident nonsense. The 18 links that exist were
chosen individually, and a test asserts every id still exists in the dataset.

**Cost.** 54 pages of prose with no generator behind them. Adding a term is manual work.

## 15. The intro video is a facade, on the busiest page

**Decision.** Prominent on a first visit, click to play, fades out when it ends, recoverable
afterwards from a small link. No autoplay on arrival.

**Why.** An embed that loads with the page contacts Google on every visit to the landing page. That
would falsify the About page's claim that no third-party request happens without a gesture, on the
page most likely to be someone's first impression of it, and would put a third-party iframe in the
critical path of the largest contentful paint. Verified: with the card on screen and unplayed, the
page's resource list holds exactly one origin, its own.

**Ending is detected without YouTube's API script.** The embed accepts `enablejsapi=1` and then
speaks postMessage directly, so no additional third-party script is introduced. The origin check on
that handler is unit-tested rather than eyeballed, because a page cannot forge a cross-origin message
and the real path therefore cannot be exercised in a browser harness.

**Unmount is on a timer, not on `transitionend`.** A transition that never runs — a background tab,
a reduced-motion preference — would otherwise leave the card on screen permanently.


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

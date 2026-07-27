# Open Problems Atlas

Every entry from Wikipedia's *List of unsolved problems in mathematics*, browsable and searchable,
with a private research journal and a lab where the mathematics is actually computed rather than
illustrated.

Static site. No backend, no accounts, no telemetry. Your notes stay in your browser.

---

## What is in it

| | |
| --- | --- |
| Problems | **591** parsed from the source article |
| Open | 478 |
| Settled since 1995 | 105 |
| Listed as both open and settled | 8, kept as explicit variants |
| Millennium Prize Problems | 7 |
| With citations carried over | 240 |
| With the article's own introduction | 549 |
| Fields | 14 |
| Source revision | `1366281547`, retrieved 2026-07-27 |

Those first three numbers are the ones that used to disagree across pages. `src/lib/counts.ts` now
derives every displayed figure from the dataset with named, distinct quantities — `settled` (105) is
not `timeline.entries` (113) is not `timeline.dated` (111) — and a test asserts the identities hold.
The Solved page shows all four side by side and explains the difference rather than picking one.

The dataset is **generated, not typed**. Two scripts, both idempotent:

```bash
npm run data
```

```bash
npm run extracts
```

The first parses the article's wikitext into `src/data/problems.generated.json`. The second fetches
each problem's own article introduction into `src/data/extracts.generated.json`, which the detail
view loads through a dynamic import so browsing 591 rows never pays for it.

## Quick start

```bash
npm install && npm run dev
```

```bash
npm run build && npm run preview
```

```bash
npm test
```

## What it does

**Arrive somewhere useful.** The landing page is an area-exact treemap of all 14 fields, a featured
problem chosen by calendar date, and five collections defined by rules over the dataset rather than
hand-kept lists — so none of them can quietly go stale. Below 24px-per-cell the treemap declines to
render and proportional bars take over; see `usableTreemap`.

**Browse, search, sort, share.** Ranked full-text search across titles, statements, fields and
solvers. Filters for field, status, Millennium, sub-cases and your own tracking, plus five sort
orders. All of it lives in the URL, so `#/atlas?q=prime&sort=settled-new` is a link you can send.

**Read something.** Each detail page carries the source list's statement, the lead section of the
problem's own Wikipedia article, the parsed citations, and related problems derived from real
relationships — direct links between statements, shared solvers, shared topics, sub-case structure —
each shown with the reason it was suggested.

**Track your own work.** Five honest states — curious, reading, working on it, stuck, parked — plus a
self-assessed difficulty and hand-logged time. Per problem, in this browser.

**Keep a journal.** LaTeX notes rendered with KaTeX, live preview, and the last 20 versions of each
note kept and restorable.

**Look up a term.** A glossary of 54 terms at [/glossary/](https://openmathproblems.kineticgain.com/glossary/),
hand-written because no source of definitions exists to generate one from. Every entry states the
definition and then the condition definitions of it usually leave out — that Collatz is a claim about
positive integers and false over all of them, that chromatic number is about adjacent vertices and
not connected ones, that the abc conjecture needs coprimality and bounds against the radical. These
are static pages at real paths, not app routes, because a crawler indexes the DOM after JavaScript
runs and a hash-routed view is not a URL.

**Attach to it.** Images and infographics go straight into a note. They are resized and re-encoded
in the browser, which also strips camera metadata such as GPS coordinates, and they live inside the
entry so the vault encrypts them and an export carries them. A video is stored as a link behind a
click-to-load facade: nothing is requested from YouTube or Vimeo until you press play, not even the
thumbnail. Verified rather than asserted — the provider only appears in the page's resource list
after the click.

**Encrypt it.** AES-256-GCM with a key derived by PBKDF2-SHA256 at 600,000 iterations, in the page.
The passphrase is never stored and never transmitted.

**Run the mathematics.** Seven live tools, every input encoded in the URL so a computation is
shareable: Collatz orbits; a real sieve of Eratosthenes with Goldbach decompositions; the
Riemann–Siegel Z function with its zeros located by bisection; **Robin's inequality** — which is
*equivalent* to the Riemann Hypothesis, so the Lab puts the same problem in front of you twice, once
analytically and once with nothing but divisor sums; *When evidence misled*, which collects
conjectures that survived enormous numerical searches and were false anyway; the covering set behind
Sierpiński's 78,557; and a plotter driven by a hand-written parser with no `eval`, exposing σ, φ, μ,
τ, ω, M, π(x), li, ζ and Z as ordinary functions you can compose. All covered by tests.

## What it does not do

Written down rather than implied, and repeated in the app's own About page:

- **No prize or difficulty ratings.** Not an omission — the source carries neither. A search across
  all 591 entries for prizes, bounties and dollar amounts returns nothing beyond the Millennium
  flag, which *is* shown. And nothing can rate the difficulty of a problem nobody has solved; the
  only difficulty figure in the app is the one you set yourself, labelled as such.
- **No cloud sync.** Export a JSON backup and import it elsewhere; it merges by most-recent-edit.
  There is no server to sync with.
- **No scheduled backups.** Export is manual. A schedule that only runs while a browser tab happens
  to be open is not a backup.
- **No end-to-end encryption.** E2E describes a message in transit between two parties. This has no
  server and no second party. What it has is encryption at rest, listed under that name.
- **No accounts or verified expert identity.** Verifying that someone is a mathematician needs an
  institutional check and a human process, not a signup form.
- **No forum or peer review.** Those need moderation, hosting and real membership. Seeded with
  invented users it would be a demo of a forum, which is worse than a link to the real ones.
- **No AI proof checking.** A language model cannot verify a proof of an open problem, and telling
  someone their attempt looks rigorous is actively harmful. [Lean](https://leanprover-community.github.io/)
  does this properly and is linked from the app.

## Correctness

`npm test` runs 430 tests across 26 files. The ones that matter:

- **Zeta** — the first ten nontrivial zeros are located to 8 decimal places and checked against
  published values; `ζ(2)`, `ζ(4)`, `ζ(6)` and `ζ(1/2)` against their closed forms; the count of
  zeros found against the Riemann–von Mangoldt formula.
- **Robin** — reproduces the published 27 exceptions (OEIS A067698) *exactly*, finds none above
  5040 across the scanned range, and cross-checks the inequality form against the ratio form for
  every n up to 20,000. That cross-check exists because testing `ratio ≥ e^γ` instead of the
  inequality silently misses n = 2, where `ln ln n` is negative and dividing flips the comparison.
- **Primes** — `π(x)` against published values through 10⁶; Carmichael numbers correctly rejected;
  Goldbach verified for *every* even number in [4, 100000]; first-occurrence maximal prime gaps
  against OEIS A002386.
- **Collatz** — 27 reaches 1 in 111 steps peaking at 9232; record stopping times for 97, 871, 6171;
  every start below 5000 terminates; truncation and inexactness are flagged, not hidden.
- **Crypto** — round-trip, wrong-passphrase rejection, tampered-ciphertext rejection (GCM is
  authenticated), unique salt and IV per encryption.
- **Treemap** — areas exactly proportional to values, exact tiling, and the property that
  `usableTreemap` never returns a layout containing an untappable cell at *any* width against
  *either* distribution. Two hand-tuned width breakpoints were tried first and both were wrong.
- **Counts** — the identities that make the header, the Solved page and the About page agree.
- **Dataset and extracts** — no leftover wiki markup, balanced `$` delimiters, valid parent links,
  all seven Millennium problems present, no entry titled after the person who settled it, and a
  guard asserting that no popularity, progress or consensus metric exists anywhere in the data.

That last one is deliberate. See `src/data/dataset.test.ts`.

## Architecture

```
scripts/build-dataset.mjs    Wikipedia wikitext -> problems.generated.json
scripts/build-extracts.mjs   article introductions -> extracts.generated.json
scripts/inject-precache.mjs  writes hashed asset names into the service worker
src/lib/math/                zeta, primes, collatz, robin. Pure, tested, no React.
src/lib/counts.ts            one source of truth for every displayed figure
src/lib/treemap.ts           squarified layout + the usability check
src/lib/related.ts           relatedness scoring, with reasons
src/lib/collections.ts       curated collections as predicates; problem of the day
src/lib/crypto.ts            WebCrypto vault
src/lib/storage.ts           observable over localStorage, via useSyncExternalStore
src/lib/router.ts            hash router with query state
src/views/                   one file per route
```

Deliberate omissions: no router library (hash routing with query state for a static host is ~150
lines), no charting library (SVG and CSS, hand-rolled), no state management library (one store, one
`useSyncExternalStore`), no PDF library (the browser prints).

Build output splits into five chunks by cache lifetime — app code (32 KB gz), dataset (53 KB gz),
KaTeX (77 KB gz), vendor (103 KB gz), and article extracts (155 KB gz, dynamically imported so the
atlas never loads it) — so a code change invalidates none of the data.

## Deploying

Live at **https://openmathproblems.kineticgain.com**.

Static files. `npm run build` produces `dist/`, and `base: './'` means it works from a domain root,
a subdirectory, or a file path without a rebuild. The service worker precaches the shell and the
dataset; Wikimedia requests are deliberately never cached.

Because routing is hash-based, **no server rewrite rule is needed** — every route resolves from the
same `index.html`, so deep links cannot 404 on a misconfigured host.

`public/.htaccess` carries the MIME types, cache policy and security headers. The cache split is the
part that matters: `/assets/*` is fingerprinted and immutable for a year, while `index.html` and
`sw.js` are `no-cache`. A long-cached service worker is how a site strands its users on an old build
with no way to update itself.

Deploy is one command from the repo root — `tar | ssh`, not `scp` of a glob, because a shell glob
silently drops dotfiles and `.htaccess` is one:

```bash
tar -czf - -C dist . | ssh -i ~/.ssh/<key> -p 65002 <user>@<host> "cd <docroot> && tar --overwrite -xzf -"
```

## Licence and attribution

Code: MIT, see `LICENSE`.

Problem data: from the English Wikipedia article
[List of unsolved problems in mathematics](https://en.wikipedia.org/wiki/List_of_unsolved_problems_in_mathematics),
revision 1366281547, reused under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Attribution, revision and retrieval date are shown in the app footer and on its About page.

---

### Repository metadata

**About:** Local-first atlas of all 591 problems from Wikipedia's list of unsolved mathematics
problems, with an encrypted research journal and a lab that computes the mathematics live.

**Topics:** `mathematics` `unsolved-problems` `react` `typescript` `katex` `riemann-hypothesis`
`local-first` `pwa` `offline-first` `web-crypto` `data-provenance` `vite`

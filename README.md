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
| Fields | 14 |
| Source revision | `1366281547`, retrieved 2026-07-27 |

The dataset is **generated, not typed**. `scripts/build-dataset.mjs` fetches the article's wikitext
from the MediaWiki API and parses it into `src/data/problems.generated.json`. Re-run it and the
atlas picks up whatever the article now says.

```bash
npm run data
```

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

## The five things it does

**Browse and search.** Ranked full-text search across titles, statements, fields and solvers.
Filters for field, status, Millennium, sub-cases and your own tracking state, all combining.

**Track your own work.** Five honest states — curious, reading, working on it, stuck, parked — plus a
self-assessed difficulty and hand-logged time. Per problem, in this browser.

**Keep a journal.** LaTeX notes rendered with KaTeX, live preview, and the last 20 versions of each
note kept and restorable.

**Encrypt it.** AES-256-GCM with a key derived by PBKDF2-SHA256 at 600,000 iterations, in the page.
The passphrase is never stored and never transmitted.

**Run the mathematics.** Collatz orbits, a real sieve of Eratosthenes, Goldbach decompositions, and
the Riemann–Siegel Z function with its zeros located by bisection — all computed live, all covered by
tests.

## What it does not do

Written down rather than implied, and repeated in the app's own About page:

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

`npm test` runs 71 tests. The ones that matter:

- **Zeta** — the first ten nontrivial zeros are located to 8 decimal places and checked against
  published values; `ζ(2)`, `ζ(4)`, `ζ(6)` and `ζ(1/2)` against their closed forms; the count of
  zeros found against the Riemann–von Mangoldt formula.
- **Primes** — `π(x)` against published values through 10⁶; Carmichael numbers correctly rejected;
  Goldbach verified for *every* even number in [4, 100000]; first-occurrence maximal prime gaps
  against OEIS A002386.
- **Collatz** — 27 reaches 1 in 111 steps peaking at 9232; record stopping times for 97, 871, 6171;
  every start below 5000 terminates; truncation and inexactness are flagged, not hidden.
- **Crypto** — round-trip, wrong-passphrase rejection, tampered-ciphertext rejection (GCM is
  authenticated), unique salt and IV per encryption.
- **Dataset** — no leftover wiki markup, balanced `$` delimiters, valid parent links, all seven
  Millennium problems present, and a guard asserting that no popularity, progress or consensus
  metric exists anywhere in the data.

That last one is deliberate. See `src/data/dataset.test.ts`.

## Architecture

```
scripts/build-dataset.mjs   Wikipedia wikitext -> problems.generated.json
src/lib/math/              zeta, primes, collatz. Pure, tested, no React.
src/lib/crypto.ts          WebCrypto vault
src/lib/storage.ts         observable over localStorage, via useSyncExternalStore
src/lib/router.ts          ~60-line hash router
src/views/                 one file per route
```

Deliberate omissions: no router library (hash routing for a static host is 60 lines), no charting
library (one chart shape, hand-rolled SVG), no state management library (one store, one
`useSyncExternalStore`), no PDF library (the browser prints).

Build output splits into four chunks by cache lifetime — app code (30 KB gz), dataset (52 KB gz),
KaTeX (77 KB gz), vendor (102 KB gz) — so a code change does not invalidate the 288 KB dataset.

## Deploying

Static files. `npm run build` produces `dist/`, and `base: './'` means it works from a domain root,
a subdirectory, or a file path without a rebuild. The service worker precaches the shell and the
dataset; Wikimedia requests are deliberately never cached.

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

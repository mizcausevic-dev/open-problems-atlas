# Open Problems Atlas vs. the AI Studio build

A file-level comparison of this project against the Gemini/AI Studio build of the same brief. Every
claim about the other build below was checked against its source before being written here; file and
line references are to that build as shipped in
`unsolved-math---research-&-progress-hub.zip`.

The brief itself is worth naming first, because it shaped both outputs. It was a single run-on
sentence of roughly forty features in which **dark mode was requested five times, offline sync five
times, end-to-end encryption four times, and export options four times**. It is a prompt that
rewards a builder for producing a surface that mentions everything, and punishes one that stops to
ask which parts a client-side app can honestly deliver.

The two builds answered that differently. Theirs implemented the list. This one implemented the
subset that can be true, and published the rest as a gap.

---

## 1. Data: 11 hand-written entries vs. 591 generated

The other build ships `src/data/problems.ts`, 697 lines containing **11 problems** typed by hand,
each with a `consensusProgress` number (all 11 have one), a `pageviewsData` block, and prose
descriptions.

The source article lists **591**.

This build ships `scripts/build-dataset.mjs`, which fetches the article's wikitext from the MediaWiki
API and parses it. The output records the source URL, the revision ID, the licence and the retrieval
date. Re-running it picks up article edits. Nothing is typed by hand except a seven-row table
mapping the Millennium problems to a field, and every entry created from that table is stamped
`fieldSource: "curated"` so the app can say so on the page.

Getting the parser right took four rounds, each caught by a test or by reading the output:

| Bug | Symptom | Fix |
| --- | --- | --- |
| Line-based parsing of multi-line `<ref>` blocks | `"(Qi'an Guan and Xiangyu Zhou, 2015)<ref>"` in descriptions | Collapse newlines inside refs and templates before splitting |
| `{{template}}` stripper ate LaTeX containing `{{` | Formulas silently truncated | Lift maths to placeholders *before* stripping templates |
| Sub-bullets skipped | **The Riemann Hypothesis was missing** — it is a `**` sub-item under "Location of nontrivial zeros of L-functions" | Promote sub-bullets to entries with a `parentId` |
| First wikilink taken as the title | An entry titled **"Aleksandar Nikolov"** — a person, because his was the only link, inside the trailing `(Solver, Year)` | Mask links, split off the attribution, take the title from the statement only |

That third row is the one to notice. A hand-written dataset of 11 problems cannot omit the Riemann
Hypothesis. A generated one can, silently, and did — until the output was read.

## 2. Invented numbers

This is the substantive difference, not a stylistic one.

**`src/utils/wikimedia.ts:67`** — `generateDeterministicFallback()`. When the Wikimedia API call
fails, the function hashes the article title and returns a fabricated `dailyViews`, `velocity30d`,
`monthlyTotal` and 10-point sparkline. The return type is identical to the real one. It flows into
the same chart, with the same `lastUpdated: new Date()` stamp. **A reader cannot tell which one they
are looking at, and neither can the code.**

**`src/data/problems.ts`** — every problem carries `consensusProgress`, a 0–100 number (Riemann 35,
Collatz 60). There is no such measurement. It is rendered as a progress bar.

**`server.ts:38-42`** — the AI proof-analysis endpoint. When no API key is configured, it returns a
hardcoded string to *any* submission:

> "AI Verification Agent: The mathematical syntax is well-formed. Equations pass KaTeX rendering
> bounds. Key steps logically connect Lemma 1 to Theorem 1."

There is no Lemma 1. There is no analysis. A user pasting a wrong proof of the Riemann Hypothesis is
told it is well-formed and that its steps connect. The `catch` block at line 60 returns a second
such string on any error.

**`src/App.tsx:97` and `:703`** — `encryptionMode: 'End-to-End AES-256'` is a string in a state
object, rendered as a badge reading `E2E ENCRYPTION SECURED`. A search of the build for `crypto.`,
`encrypt` or `subtle` returns seven matches; **all seven are the word "author" or that badge string.
No encryption is implemented.** Data is plain JSON in `localStorage`.

**`src/App.tsx:49-60`** — the app boots as `Dr. Elena Vance`, `Verified Researcher`, Institute for
Advanced Study, Princeton, with an ORCID and a stock photo. `isVerified: true`. Alongside are
invented Slack notifications from `Prof. Jonathan Sterling`, invented peer reviews, and a backup
schedule reporting `Google Cloud Storage` and `lastBackup: <now>` for a backup that does not run.

In this build:

- `src/lib/pageviews.ts` returns `{ kind: 'error', message }` when the API cannot be reached. The
  panel shows the reason and no number. The reason is written in the file header.
- There is no progress, popularity or consensus field. `src/data/dataset.test.ts` **fails the build**
  if one appears — it greps the dataset for `consensusProgress`, `pageviewsData`, `popularity`,
  `difficultyScore` and friends.
- Encryption is `src/lib/crypto.ts`: AES-256-GCM, PBKDF2-SHA256 at 600,000 iterations, verified by
  round-trip, wrong-passphrase and tampered-ciphertext tests, and confirmed working in-browser. It
  is called *encryption at rest*, and the UI explains why it is not end-to-end.
- There is no fictional user. The dashboard is empty until you put something in it.

## 3. Mathematics that is actually the mathematics

**`src/components/visualizers/ZetaVisualizer.tsx:13-30`** computes, over `n = 1..12`:

```
re += (1/√n)·cos(t·ln n)     im -= (1/√n)·sin(t·ln n)
```

and captions the result *"Riemann Zeta Complex Spiral"*, *"Parametric orbit ζ(1/2+it) passing
through origin at non-trivial zeros"*.

That is the Dirichlet series for ζ(s) at s = 1/2 + it. **It does not converge there.** The curve is
an artefact of stopping at n = 12; it does not pass through the origin at the zeros, and adding
terms does not make it. The five zeros listed beside it are correct values, hardcoded, unconnected
to the drawing.

This build's `src/lib/math/zeta.ts` uses the Dirichlet eta function, which does converge for
Re(s) > 0, with Borwein acceleration, and `ζ(s) = η(s)/(1−2^(1−s))`. It plots the Riemann–Siegel Z
function, which is real-valued on the critical line, so a zero is a visible axis crossing. The zeros
are then **found by bisection** and printed next to the published values.

Two bugs the tests caught in the process:

- A fixed 32-term Borwein sum is fine at small heights and wrong by 1.4 × 10⁻⁶ at t = 44, because the
  error bound carries a factor of e^(π|t|/2). Term count is now a function of height.
- Simpson's rule applied directly to `1/ln t` over `[2, 10⁶]` was off by 15, because the integrand
  collapses from 1.44 to 0.25 inside the first few steps. Substituting `t = eᵘ` fixed it.

Neither would have been noticed without checking against published values. Both are the kind of
error that produces a plot that looks entirely convincing.

The same standard applies across the lab: a real sieve of Eratosthenes, real Goldbach
decompositions (verified for **every** even number in [4, 100000]), real Collatz orbits with
`Number.isSafeInteger` guards that report inexactness rather than rounding it away.

There is also a rendering bug worth mentioning because it is visible on load: at least four of the
other build's components put LaTeX in plain JSX text — `CollatzVisualizer.tsx:68`,
`GoldbachVisualizer.tsx:42`, `NavierStokesVisualizer.tsx:108`, `ZetaVisualizer.tsx:53` — where
`$n \mapsto n/2$` renders as the literal characters, dollar signs and all, next to correctly
typeset KaTeX elsewhere on the same panel.

## 4. Features that were dropped, and why

| Brief asked for | Other build | Here |
| --- | --- | --- |
| Secure authentication for academic contributors | `isVerified: true` on a hardcoded object; no auth of any kind | Not built. Institutional verification needs a human process, and a badge that verifies nothing is worse than no badge |
| Community forum, peer review | Seeded with invented users and invented reviews | Not built. Links to MathOverflow instead |
| End-to-end encryption | A badge | Encryption at rest, real, tested, named accurately |
| Automated backup schedules | A settings object showing `lastBackup: now` | Manual export. A schedule that runs only while a tab is open is not a backup |
| Cloud storage, cross-platform sync | Claimed in copy; `localStorage` in fact | Export/import by file, merging on most-recent-edit. Stated as such |
| AI task prioritisation, AI proof analysis | Hardcoded fallbacks presented as analysis | Not built. Links to Lean |
| Slack notifications | An array of fake notifications | Not built |
| Modular plugin system | Not present | Not built |
| Offline sync | `localStorage` writes | A real service worker. Precaches shell and dataset; deliberately never caches Wikimedia responses |
| LaTeX editor, export | Present, good | Kept and extended: KaTeX preview, revision history, and .tex/.md/.json/PDF export |
| Dark mode | Inverted palette; cyan accent on white | Two designed palettes. The BERT cyan is unreadable on white, so light mode uses a deep teal |

The app carries this table itself, on its About page, so a user reading the app sees the same list a
developer reading the repo does.

## 5. What was worth porting

Credit where due. Four ideas in the other build were good and are here in some form:

1. **ELI5 vs. technical framing.** Its `LaymanExpertToggle` is a genuinely good instinct. Here it
   becomes the atlas prose: plain-language statements from the article, with maths typeset inline
   rather than hidden behind a toggle.
2. **Per-problem interactive visualisers.** The right idea. Rebuilt so the picture is derived from
   the definition.
3. **Wikipedia pageviews as an attention signal.** Also the right idea, and its API integration
   (`wikimedia.ts:7-65`) is competent. Only the fallback had to go.
4. **A solved-problems timeline.** Underused there. Here it is a whole view, because "105 of these
   fell in thirty years" is the most encouraging thing in the source article.

Its React is also perfectly reasonable — clean components, sensible Tailwind, Framer Motion where it
belongs. The problems are not craft problems. They are honesty problems.

## 6. Engineering delta

| | Other build | Here |
| --- | --- | --- |
| Tests | 0 | 71 |
| Typecheck in build | `lint` script exists, not wired to `build` | `npm run build` runs `tsc --noEmit` first |
| Backend | Express + `@google/genai`, needs an API key | None. Static files |
| Routing | One `activeView` state string | Hash router; every problem has a shareable URL |
| Largest file | `App.tsx`, 657 lines holding every view | Largest view is 380 lines |
| Production deps | 12 incl. Express, dotenv, `@google/genai` | 5 |
| Bundle | 3814 lines TS/TSX, single chunk | 4 chunks split by cache lifetime; app code 30 KB gz |
| Mobile | Not verified | Zero horizontal overflow measured across all 9 routes at 375 px |
| Accessibility | Icon buttons unlabelled | Skip link, labelled controls, `aria-pressed` on toggles, text alternatives on every chart, `prefers-reduced-motion` respected |

---

## The one-line version

The other build implemented the prompt. This one implemented the part of the prompt that can be
true, and put the rest in a capability matrix where a user can see it.

For an app about unsolved problems in mathematics — a field whose entire discipline is refusing to
accept a claim without a proof — a fabricated view count and an AI that tells you your proof looks
rigorous are not small blemishes. They are the app arguing against its own subject.

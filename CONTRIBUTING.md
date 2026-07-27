# Contributing

Thanks for looking. This document is mostly about one rule, because that rule is the reason the
project exists.

## The rule: nothing is shown that cannot be sourced or computed

Every number this app displays is either computed from a definition in the browser, or parsed from a
cited source, and it says which. That is not a style preference — it is the entire premise.

Concretely, a change will be rejected if it:

- adds a metric with no source (`popularity`, `progress`, `difficulty`, `trending`, a "consensus"
  score). `src/data/dataset.test.ts` greps the dataset for exactly these names and **fails the
  build** if one appears
- generates a plausible-looking value when real data is unavailable, instead of reporting the
  failure. If the Wikimedia API cannot be reached, the panel says so and shows nothing
- implies progress toward solving an open problem, or suggests an approach
- presents a finite computation as evidence for a universal claim without saying so in the same
  breath

The last one is subtle and matters most. "Checked to 10⁷, still holds" is fine. "Verified" is not.
The Lab has a whole tab, *When evidence misled*, about conjectures that were overwhelmingly
supported numerically and false anyway.

## Mathematics must be checked against published values

A new computation needs a test that asserts it against something external — OEIS, a published
table, a closed form, a paper. Not against itself, and not against a value this codebase produced.

Look at the existing tests for the standard:

- `zeta.test.ts` locates the first ten nontrivial zeros to 8 decimal places and compares them to
  Odlyzko's tables
- `robin.test.ts` reproduces the 27 published exceptions (OEIS A067698) *exactly*, and separately
  checks the inequality form against the ratio form, because testing `ratio >= e^γ` silently misses
  n = 2 where `ln ln n` is negative
- `arithmetic.test.ts` checks M(10ⁿ) against A084237 and reproduces Leech's 1957 crossover at 26,861
- `covering.test.ts` includes a **negative control**: removing any prime from the covering set must
  leave a gap. Without it, a checker that marked everything "covered" would pass

That negative-control habit is worth copying. A test that can only pass is not a test.

## Dependencies

Five production dependencies: `react`, `react-dom`, `katex`, `lucide-react`, `motion`.

`react-router`, `recharts`, `zustand` and `jspdf` were each considered and refused, with the
replacement written down in `DECISIONS-Claude.md`. Adding one needs a reason in the pull request
that survives the same scrutiny.

## What is deliberately not built

Read the capability matrix on the [About page](https://openmathproblems.kineticgain.com/#/about)
before proposing a feature. Cloud sync, accounts, a forum, peer review, AI proof-checking and
difficulty ratings are all absent **on purpose**, and each entry says why. Several of them are
category errors for a corpus of unsolved problems rather than missing work.

## Working on it

```bash
npm install && npm run dev
```

```bash
npm test
```

```bash
npm run typecheck && npm run build
```

The generated datasets are committed, so a clean clone builds with no network access. Regenerate
them only when you mean to:

```bash
npm run data:all
```

That re-scrapes the source article and re-fetches 549 article introductions. It will change the
recorded revision id, which is a real edit to the provenance record, not a refresh.

## Pull requests

- CI runs typecheck, the full suite, and a build. All three must pass.
- Comments should explain *why*, especially where the obvious approach was wrong. Much of this
  codebase's commentary records a bug that was actually hit — a diverging series plotted as if it
  converged, a downsampler that dropped the peaks it existed to show, a prototype-chain leak in the
  expression parser. That history is the useful part.
- Prose in the UI: no em dashes, and prefer the smaller true statement to the larger impressive one.

## Data licence

Problem data and article extracts come from Wikipedia under CC BY-SA 4.0. Contributions that touch
the dataset must preserve the attribution, the licence, and the recorded source revision. See
`LICENSE-DATA.md`.

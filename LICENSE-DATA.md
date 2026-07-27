# Data licence and attribution

This repository contains two differently licensed things, and the boundary matters to anyone
reusing either.

| | |
| --- | --- |
| **Software** — everything except the files listed below | MIT, see [`LICENSE`](LICENSE) |
| **Data** — the generated datasets and the text rendered from them | **CC BY-SA 4.0** |

## The data files

- `src/data/problems.generated.json`
- `src/data/extracts.generated.json`

Both are derived from the English Wikipedia and are licensed
**[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**, the same licence as the source.

## Attribution

**Title:** List of unsolved problems in mathematics
**Source:** <https://en.wikipedia.org/wiki/List_of_unsolved_problems_in_mathematics>
**Author:** Wikipedia contributors
**Licence:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
**Revision used:** `1366281547`, retrieved 2026-07-27

The article introductions in `extracts.generated.json` come from the individual Wikipedia articles
for each problem, retrieved through the same project's API on the same date, under the same licence.
Each entry records the article it came from in its `resolvedTitle` field.

The recorded revision id is the point of the exercise: it makes the snapshot checkable. Anyone can
fetch that exact revision and compare.

## Changes made to the source material

CC BY-SA 4.0 requires that modifications be indicated. The generator scripts make these, and only
these:

1. **Markup removal.** Wikitext links, templates, reference tags and formatting markers are stripped
   to plain text. `[[A|B]]` becomes `B`.
2. **Mathematics converted.** `<math>…</math>` becomes `$…$` for rendering with KaTeX. In the
   article extracts, MediaWiki's plain-text rendering emits a bare symbol followed by a separate
   `{\displaystyle …}` block; these are collapsed into a single inline expression and the duplicate
   symbol is dropped.
3. **Truncation.** Article introductions are cut at 1,500 characters on a sentence boundary. Entries
   affected carry `truncated: true`.
4. **Restructuring.** Bulleted entries are parsed into records with a field, a status and a parent
   relationship, derived from the article's own section headings and bullet nesting.
5. **One curated addition.** Six of the seven Millennium Prize Problems appear in the article outside
   its by-field taxonomy, so their field is supplied by this project rather than read from a heading.
   Every such record is marked `fieldSource: "curated"` and the UI says so on the page.

No entry's meaning is edited, and no content is added beyond point 5. The scripts that perform all
of the above are in [`scripts/`](scripts/) and can be re-run to reproduce the datasets.

## Reusing the data

Under ShareAlike, a modified version of these datasets must be distributed under CC BY-SA 4.0 or a
compatible licence, with attribution as above. The MIT licence on the software does **not** extend
to them.

## Not covered by the above

- **Published mathematical values** cited in the app — the zeros of the zeta function, the exceptions
  to Robin's inequality, Mertens values, Leech's crossover — are facts, not copyrightable
  expression. They are attributed to their sources (Odlyzko's tables, OEIS A067698, A084237, A007350)
  because that is what makes them checkable, not because a licence requires it.
- **Wikipedia** and **Wikimedia** are trademarks of the Wikimedia Foundation. This project is not
  affiliated with or endorsed by it, and uses the names only to identify the source of the data.
- **The Millennium Prize Problems** are a programme of the Clay Mathematics Institute. This project
  links to their official statements and does not reproduce them.

## Questions

If you believe the attribution here is insufficient, or that something is reproduced beyond what the
licence permits, please open an issue. Getting this right matters more than keeping any particular
piece of content.

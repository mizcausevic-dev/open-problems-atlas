/**
 * Domain types.
 *
 * Two rules hold everywhere below:
 *
 * 1. Anything sourced from Wikipedia is optional. The article does not describe
 *    every problem, so `description`, `solvedBy` and friends are `?`. A missing
 *    value renders as "not recorded", never as an empty string or a zero.
 *
 * 2. Anything the user creates lives in a separate type tree (`TrackedProblem`,
 *    `JournalEntry`). Source data and user data are never merged into one
 *    object, so the UI can always say which is which.
 */

export type ProblemStatus = 'open' | 'solved' | 'partially-solved';

/** Where a problem's field classification came from. Surfaced in the UI. */
export type FieldSource = 'wikipedia-section' | 'curated';

export interface Reference {
  title?: string;
  url?: string;
  doi?: string;
  arxiv?: string;
  year?: string;
}

/** A differing listing of the same article elsewhere in the source page. */
export interface ProblemVariant {
  status: ProblemStatus;
  field: string;
  description?: string;
  solvedYear?: number;
  solvedBy?: string;
  references?: Reference[];
}

export interface Problem {
  id: string;
  title: string;
  /**
   * Absent for the ~29 entries the source article states inline without linking
   * to a dedicated article ("Are there infinitely many Kynea primes?"). Callers
   * must handle this: there is genuinely no article to link to or to ask the
   * pageviews API about.
   */
  wikipediaTitle?: string;
  wikipediaAnchor?: string;
  field: string;
  fieldSource: FieldSource;
  subfield?: string;
  status: ProblemStatus;
  /** Bullet nesting depth in the source article. 1 = top level. */
  depth: number;
  /** Id of the enclosing bullet, when this problem was listed as a sub-case. */
  parentId?: string;
  description?: string;
  solvedYear?: number;
  solvedBy?: string;
  millennium?: boolean;
  relatedTopics?: string[];
  references?: Reference[];
  /** Other fields the same article is listed under. */
  alsoIn?: string[];
  variants?: ProblemVariant[];
}

export interface DatasetMeta {
  source: {
    page: string;
    url: string;
    revisionId: number | null;
    license: string;
    licenseUrl: string;
  };
  generatedBy: string;
  generatedAt: string;
  counts: {
    total: number;
    open: number;
    solved: number;
    millennium: number;
    withDescription: number;
    withReferences: number;
  };
  fields: string[];
}

export interface Dataset {
  meta: DatasetMeta;
  problems: Problem[];
}

// ---------------------------------------------------------------------------
// User data. Local to this browser unless the user exports it.
// ---------------------------------------------------------------------------

/** Where the user is with a problem. Deliberately about study, not about proof. */
export type TrackState =
  | 'untracked'
  | 'curious'
  | 'reading'
  | 'working'
  | 'stuck'
  | 'parked';

export const TRACK_STATES: Exclude<TrackState, 'untracked'>[] = [
  'curious',
  'reading',
  'working',
  'stuck',
  'parked',
];

export interface TrackedProblem {
  problemId: string;
  state: TrackState;
  /** How hard it feels to this user right now, 1-5. Self-assessment, not a score. */
  perceivedDifficulty?: number;
  /** Minutes the user has logged against this problem. User-entered only. */
  minutesLogged?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  problemId: string;
  title: string;
  /** LaTeX-flavoured markdown. Rendered with KaTeX between $ delimiters. */
  body: string;
  createdAt: string;
  updatedAt: string;
  /** Prior bodies, newest first. Capped; see storage.ts MAX_REVISIONS. */
  revisions: { body: string; savedAt: string }[];
}

/** The whole of the user's data. This is what the vault encrypts and export writes. */
export interface UserData {
  schemaVersion: 1;
  tracked: Record<string, TrackedProblem>;
  journal: JournalEntry[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Live-fetch results. Every remote value carries its own success/failure state
// so a component can never mistake "we could not reach the API" for "zero".
// ---------------------------------------------------------------------------

export type Remote<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; value: T; fetchedAt: string }
  | { kind: 'error'; message: string };

export interface Pageviews {
  /** Daily view counts, oldest first, exactly as returned by the Wikimedia API. */
  series: { date: string; views: number }[];
  total: number;
  /** Mean daily views over the returned window. */
  mean: number;
  /** Last 14 days vs the 14 before, as a percentage. Undefined if the window is too short. */
  changePct?: number;
  windowStart: string;
  windowEnd: string;
}

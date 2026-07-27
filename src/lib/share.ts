/**
 * Sharing, built out of plain links.
 *
 * The hard constraint this respects: the About page promises no third-party
 * requests beyond the on-demand Wikimedia pageview call, and the CSP enforces
 * it. Every official share widget breaks that — X, LinkedIn and Reddit all ship
 * an SDK that loads on page render, sets cookies and reports the visit whether
 * or not anyone clicks.
 *
 * So there are no widgets here, only URLs. A share target is an `<a href>` the
 * visitor may choose to follow. Nothing is requested, no script is loaded and no
 * cookie is set unless a person deliberately clicks, at which point they have
 * navigated to that site and its rules obviously apply. This is the difference
 * between offering to share and reporting that you were read.
 *
 * `navigator.share` is preferred where it exists because it is strictly better
 * on the same terms: the operating system draws the sheet, the page learns
 * nothing, and the user gets their real installed apps rather than my guess at
 * which seven sites they use.
 */

export interface ShareTarget {
  id: string;
  label: string;
  href: string;
}

/**
 * A caveat worth stating plainly rather than hiding.
 *
 * Routes are fragments (`#/p/riemann-hypothesis`), and every social crawler
 * discards the fragment before fetching. A shared link therefore lands the human
 * on the right problem, but the PREVIEW CARD is always the site-level one. That
 * is a real limitation of hash routing, not something the share text can fix,
 * and it is why the share text below names the problem explicitly: the sentence
 * has to carry the specificity the card cannot.
 */
export function shareUrl(path = window.location.hash): string {
  const origin = `${window.location.origin}${window.location.pathname}`;
  return path.startsWith('#') ? `${origin}${path}` : `${origin}#${path}`;
}

/**
 * Share text is assembled from dataset fields, never authored per problem.
 *
 * A hand-written blurb would be an editorial claim about a problem this project
 * has no standing to characterise — "the most important open question in
 * mathematics" is the kind of sentence that writes itself and cannot be sourced.
 * Field and status are facts the dataset carries.
 */
export function shareText(opts: { title: string; field?: string; status?: string }): string {
  const { title, field, status } = opts;
  if (!field) return `${title} — Open Problems Atlas`;

  const described =
    status === 'solved'
      ? `a solved problem in ${field}`
      : status === 'partially-solved'
        ? `a partially solved problem in ${field}`
        : `an open problem in ${field}`;

  return `${title} — ${described}. Open Problems Atlas`;
}

/**
 * Targets are ordered by how plausibly a person reading about unsolved
 * mathematics actually uses them, not by market share. Hacker News and Reddit
 * earn their place here in a way they would not on a consumer product.
 *
 * Mastodon is deliberately absent: sharing requires the visitor's own instance
 * hostname, and the alternatives are prompting for it or hardcoding someone
 * else's server. Bluesky needs neither, so it is included and Mastodon is not.
 */
export function shareTargets(url: string, text: string): ShareTarget[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);

  return [
    { id: 'x', label: 'X', href: `https://x.com/intent/tweet?text=${t}&url=${u}` },
    { id: 'bluesky', label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}` },
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'reddit', label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { id: 'hackernews', label: 'Hacker News', href: `https://news.ycombinator.com/submitlink?u=${u}&t=${t}` },
    { id: 'email', label: 'Email', href: `mailto:?subject=${t}&body=${encodeURIComponent(`${text}\n\n${url}`)}` },
  ];
}

/**
 * Every target must be a plain navigation to a known host over https.
 *
 * This is the invariant the privacy claim rests on, so it is checkable rather
 * than merely intended: `share.test.ts` asserts it against every target, which
 * means adding a tracking pixel or an SDK-backed endpoint fails the suite.
 */
export const ALLOWED_SHARE_HOSTS = [
  'x.com',
  'bsky.app',
  'www.linkedin.com',
  'www.reddit.com',
  'news.ycombinator.com',
];

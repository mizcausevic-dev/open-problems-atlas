import { describe, it, expect } from 'vitest';
import { shareTargets, shareText, shareUrl, ALLOWED_SHARE_HOSTS } from './share';

const URL_ = 'https://openmathproblems.kineticgain.com/#/p/riemann-hypothesis';
const TEXT = 'Riemann hypothesis — an open problem in Number theory. Open Problems Atlas';

describe('share targets are links, not widgets', () => {
  const targets = shareTargets(URL_, TEXT);

  it('offers every target over https to a known host, or as mailto', () => {
    for (const t of targets) {
      if (t.id === 'email') {
        expect(t.href.startsWith('mailto:')).toBe(true);
        continue;
      }
      const u = new URL(t.href);
      expect(u.protocol).toBe('https:');
      expect(ALLOWED_SHARE_HOSTS).toContain(u.hostname);
    }
  });

  /**
   * The privacy claim, made checkable.
   *
   * The About page says no third-party request happens without the visitor
   * asking. Share widgets are the classic way that quietly stops being true: an
   * SDK URL or a pixel endpoint sneaks in, loads on render, and the page is
   * reporting its visitors to five companies while the copy still claims it does
   * not. If someone adds one, this fails.
   */
  it('contains no script, pixel, or SDK endpoint', () => {
    for (const t of targets) {
      expect(t.href).not.toMatch(/\.js(\?|$)/);
      expect(t.href).not.toMatch(/(pixel|beacon|collect|track|analytics|widgets?\.)/i);
    }
  });

  it('encodes the url and text so a title with & or # survives', () => {
    const hostile = shareTargets('https://e.com/#/p/a&b', 'Hausdorff & Besicovitch #1');
    const x = new URL(hostile.find((t) => t.id === 'x')!.href);
    expect(x.searchParams.get('url')).toBe('https://e.com/#/p/a&b');
    expect(x.searchParams.get('text')).toBe('Hausdorff & Besicovitch #1');
  });

  it('gives Bluesky one composed string, since it takes no separate url param', () => {
    const bsky = new URL(shareTargets(URL_, TEXT).find((t) => t.id === 'bluesky')!.href);
    expect(bsky.searchParams.get('text')).toBe(`${TEXT} ${URL_}`);
  });
});

describe('share text is assembled from dataset fields', () => {
  it('describes status accurately for each of the three cases', () => {
    expect(shareText({ title: 'A', field: 'Algebra', status: 'open' })).toContain('an open problem in Algebra');
    expect(shareText({ title: 'B', field: 'Topology', status: 'solved' })).toContain('a solved problem in Topology');
    expect(shareText({ title: 'C', field: 'Geometry', status: 'partially-solved' })).toContain(
      'a partially solved problem in Geometry',
    );
  });

  it('falls back to the bare title when there is no field to cite', () => {
    expect(shareText({ title: 'Lab' })).toBe('Lab — Open Problems Atlas');
  });

  /**
   * Negative control on the no-fabrication rule. If someone later "improves" the
   * copy with an editorial adjective, this catches it — none of these words can
   * be sourced from the dataset, and calling an unsolved problem "famous" or
   * "important" is exactly the kind of claim this project refuses to make.
   */
  it('never editorialises about a problem it cannot characterise', () => {
    const text = shareText({ title: 'Riemann hypothesis', field: 'Number theory', status: 'open' });
    expect(text).not.toMatch(/famous|important|hardest|greatest|legendary|notorious/i);
  });
});

describe('shareUrl', () => {
  it('builds an absolute url from the current hash route', () => {
    // jsdom is not configured for this suite, so drive the function directly
    // with an explicit path rather than depending on a global location.
    const stub = { origin: 'https://x.test', pathname: '/' } as Location;
    const real = globalThis.window;
    globalThis.window = { location: stub } as Window & typeof globalThis;
    try {
      expect(shareUrl('#/p/abc')).toBe('https://x.test/#/p/abc');
      expect(shareUrl('/p/abc')).toBe('https://x.test/#/p/abc');
    } finally {
      globalThis.window = real;
    }
  });
});

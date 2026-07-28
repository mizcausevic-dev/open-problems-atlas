import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  attachmentChars,
  totalAttachmentChars,
  parseVideoUrl,
  embedUrl,
  newVideoAttachment,
  AttachmentError,
  MAX_TOTAL_ATTACHMENT_CHARS,
  MAX_ATTACHMENT_CHARS,
  EMBED_IFRAME,
} from './attachments';

describe('parseVideoUrl', () => {
  it('accepts the YouTube shapes people actually paste', () => {
    const cases = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      // Extra params are normal from a share sheet and must not defeat parsing.
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLabc',
    ];
    for (const c of cases) {
      expect(parseVideoUrl(c), c).toEqual({
        provider: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });
    }
  });

  it('accepts Vimeo watch and player urls', () => {
    expect(parseVideoUrl('https://vimeo.com/347119375')).toEqual({
      provider: 'vimeo',
      videoId: '347119375',
      url: 'https://vimeo.com/347119375',
    });
    expect(parseVideoUrl('https://player.vimeo.com/video/347119375')?.videoId).toBe('347119375');
  });

  /**
   * The important half. A parser that half-matches produces an embed URL that
   * loads a blank frame, and the user has no way to tell whether the video is
   * gone or the app is broken. Declining is the better failure.
   */
  it('declines anything it cannot parse with certainty', () => {
    const rejects = [
      'not a url',
      'https://example.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/',
      'https://youtube.com/watch',
      'https://vimeo.com/notanumber',
      'https://vimeo.com/',
      // Scheme-relative and javascript: must never survive to an iframe src.
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '//youtube.com/watch?v=dQw4w9WgXcQ',
    ];
    for (const r of rejects) expect(parseVideoUrl(r), r).toBeNull();
  });

  it('rejects a lookalike host rather than trusting a substring', () => {
    // The classic mistake is `href.includes('youtube.com')`, which happily
    // accepts an attacker-controlled domain.
    expect(parseVideoUrl('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseVideoUrl('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

/**
 * Reads one directive out of the SHIPPED Content-Security-Policy header value.
 *
 * Anchoring on the header line matters. A first attempt matched /frame-src (...)/
 * anywhere in the file and silently picked up the explanatory comment sitting
 * above the directive, so the test failed against a correct policy and would
 * equally have passed against a broken one. A negative control caught it, which
 * is the entire argument for writing negative controls.
 */
function cspDirective(name: string): string {
  const htaccess = readFileSync(resolve(process.cwd(), 'public/.htaccess'), 'utf8');
  const header = /Content-Security-Policy\s+"([^"]+)"/.exec(htaccess)?.[1] ?? '';
  const directive = header.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  return directive ?? '';
}

describe('embedUrl', () => {
  it('sends YouTube to the nocookie domain, not youtube.com', () => {
    const url = embedUrl({ provider: 'youtube', videoId: 'abc123xyz' })!;
    expect(url.startsWith('https://www.youtube-nocookie.com/embed/abc123xyz')).toBe(true);
    expect(url).not.toContain('//www.youtube.com');
  });

  it('uses the Vimeo player host', () => {
    expect(embedUrl({ provider: 'vimeo', videoId: '347119375' })).toContain(
      'https://player.vimeo.com/video/347119375',
    );
  });

  it('returns null rather than a broken src when there is no id', () => {
    expect(embedUrl({ provider: 'youtube' })).toBeNull();
  });

  /**
   * Whatever embedUrl returns goes straight into an iframe src, so its host set
   * must stay inside the CSP frame-src allowlist in public/.htaccess. If a third
   * provider is added and this is forgotten, the frame is blocked at runtime
   * with an error only the console shows.
   */
  it('only ever targets hosts named in the CSP frame-src allowlist', () => {
    // Read the real policy rather than a copy of it. A hardcoded list here would
    // pass happily while the shipped header said something else, which is the
    // exact drift this test exists to catch.
    const frameSrc = cspDirective('frame-src');
    expect(frameSrc, 'no frame-src directive found in public/.htaccess').not.toBe('');

    for (const p of ['youtube', 'vimeo'] as const) {
      const u = new URL(embedUrl({ provider: p, videoId: p === 'vimeo' ? '347119375' : 'abc123xyz' })!);
      expect(u.protocol).toBe('https:');
      expect(frameSrc, `frame-src does not permit ${u.hostname}`).toContain(u.origin);
    }
  });

  it('does not widen connect-src to the video hosts', () => {
    // A player may be framed. It must not become a place this app can fetch
    // from — that is a different capability and would be a real regression.
    const connectSrc = cspDirective('connect-src');
    expect(connectSrc).not.toContain('youtube');
    expect(connectSrc).not.toContain('vimeo');
  });
});

describe('newVideoAttachment', () => {
  it('stores the canonical watch url, not whatever was pasted', () => {
    const a = newVideoAttachment('https://youtu.be/dQw4w9WgXcQ?t=9');
    expect(a.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(a.kind).toBe('video');
    expect(a.data).toBeUndefined(); // videos are references, never bytes
  });

  it('throws a message meant for a person when the link is unrecognised', () => {
    expect(() => newVideoAttachment('https://example.com/video')).toThrow(AttachmentError);
    expect(() => newVideoAttachment('https://example.com/video')).toThrow(/YouTube and Vimeo/);
  });
});

describe('budget accounting', () => {
  const img = (chars: number) => ({
    id: 'x',
    kind: 'image' as const,
    caption: '',
    addedAt: '',
    data: 'd'.repeat(chars),
  });

  it('counts across every note, not per note', () => {
    // The failure this prevents: eleven notes each under the per-note limit
    // still exhaust one shared localStorage quota.
    const entries = [{ attachments: [img(1000)] }, { attachments: [img(2000), img(3000)] }];
    expect(totalAttachmentChars(entries)).toBeGreaterThan(6000);
    expect(totalAttachmentChars([])).toBe(0);
    expect(totalAttachmentChars([{}])).toBe(0); // entries predating attachments
  });

  it('charges for the url and caption too, not only the image bytes', () => {
    expect(attachmentChars(img(100))).toBeGreaterThan(100);
  });

  it('keeps a single attachment well inside the shared budget', () => {
    // A per-item cap at or above the total would make the total meaningless.
    expect(MAX_ATTACHMENT_CHARS * 4).toBeLessThan(MAX_TOTAL_ATTACHMENT_CHARS);
  });
});

describe('embed iframe attributes', () => {
  /**
   * The regression that shipped. referrerPolicy="no-referrer" makes YouTube
   * refuse to play: the player emits error 153, "Video player configuration
   * error", and renders a black frame with a link out to YouTube. It was
   * reproduced on the deployed site by running two iframes side by side that
   * differed only in this attribute — the no-referrer one emitted onError 153,
   * the other emitted nothing — and it reproduced both with and without the
   * `origin=` parameter, so it affected the journal embeds too.
   *
   * The stricter value bought nothing: the API handshake passes `origin=` in
   * the URL anyway, so YouTube already knows the site.
   */
  it('never uses no-referrer, which breaks YouTube playback with error 153', () => {
    expect(EMBED_IFRAME.referrerPolicy).not.toBe('no-referrer');
  });

  it('still withholds the path, sending only the origin', () => {
    // The middle ground, and the same value as the site-wide Referrer-Policy
    // header: YouTube learns the site, not which problem was being read.
    expect(EMBED_IFRAME.referrerPolicy).toBe('strict-origin-when-cross-origin');
  });

  it('matches the site-wide Referrer-Policy rather than fighting it', () => {
    const htaccess = readFileSync(resolve(process.cwd(), 'public/.htaccess'), 'utf8');
    const header = /Referrer-Policy\s+"([^"]+)"/.exec(htaccess)?.[1];
    expect(header).toBe(EMBED_IFRAME.referrerPolicy);
  });

  it('keeps allow-same-origin, which playback requires', () => {
    expect(EMBED_IFRAME.sandbox).toContain('allow-same-origin');
    expect(EMBED_IFRAME.sandbox).toContain('allow-scripts');
  });
});

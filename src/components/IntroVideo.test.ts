/**
 * The origin check on the intro video's message handler.
 *
 * This is tested rather than eyeballed because it cannot be exercised in a
 * browser harness: a page cannot forge a cross-origin message, so the real path
 * only runs against the actual YouTube player. The handler acts on what it
 * receives and every frame and script on the page can post to this window, so
 * the check has to be right the first time.
 */

import { describe, it, expect } from 'vitest';
import { isVideoEndedMessage, PLAYER_ORIGIN } from './IntroVideo';

const ended = JSON.stringify({ event: 'onStateChange', info: 0 });

describe('isVideoEndedMessage', () => {
  it('accepts the ended event from the player origin', () => {
    expect(isVideoEndedMessage(PLAYER_ORIGIN, ended)).toBe(true);
    // The widget protocol sometimes delivers an object rather than a string.
    expect(isVideoEndedMessage(PLAYER_ORIGIN, { event: 'onStateChange', info: 0 })).toBe(true);
    expect(isVideoEndedMessage(PLAYER_ORIGIN, { event: 'onStateChange', info: '0' })).toBe(true);
  });

  it('targets the nocookie host, not youtube.com', () => {
    expect(PLAYER_ORIGIN).toBe('https://www.youtube-nocookie.com');
  });

  it('rejects the same payload from any other origin', () => {
    for (const origin of [
      'https://www.youtube.com',
      'https://youtube-nocookie.com', // no www: a different origin
      'http://www.youtube-nocookie.com', // http: a different origin
      'https://www.youtube-nocookie.com.evil.test',
      'https://openmathproblems.kineticgain.com',
      'null',
      '',
    ]) {
      expect(isVideoEndedMessage(origin, ended), origin).toBe(false);
    }
  });

  it('ignores other player states', () => {
    // 1 playing, 2 paused, 3 buffering, 5 cued, -1 unstarted.
    for (const info of [1, 2, 3, 5, -1]) {
      expect(isVideoEndedMessage(PLAYER_ORIGIN, { event: 'onStateChange', info }), String(info)).toBe(
        false,
      );
    }
  });

  it('ignores other events and malformed chatter', () => {
    expect(isVideoEndedMessage(PLAYER_ORIGIN, { event: 'onReady', info: 0 })).toBe(false);
    expect(isVideoEndedMessage(PLAYER_ORIGIN, 'not json at all')).toBe(false);
    expect(isVideoEndedMessage(PLAYER_ORIGIN, null)).toBe(false);
    expect(isVideoEndedMessage(PLAYER_ORIGIN, undefined)).toBe(false);
    expect(isVideoEndedMessage(PLAYER_ORIGIN, 42)).toBe(false);
  });

  /**
   * The bug this shape invites. Number(null) and Number('') are both 0, so a
   * naive `Number(msg.info) === 0` reports "ended" for any onStateChange message
   * carrying an empty info field — dismissing the video the moment the player
   * emits one, before it has played.
   */
  it('does not treat an empty info field as ended', () => {
    expect(isVideoEndedMessage(PLAYER_ORIGIN, { event: 'onStateChange', info: null })).toBe(false);
    expect(isVideoEndedMessage(PLAYER_ORIGIN, { event: 'onStateChange', info: '' })).toBe(false);
    expect(isVideoEndedMessage(PLAYER_ORIGIN, { event: 'onStateChange' })).toBe(false);
  });
});

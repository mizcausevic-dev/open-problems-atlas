// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, WrongPassphraseError, assessPassphrase, PBKDF2_ITERATIONS } from './crypto';

// PBKDF2 at 600k iterations is intentionally slow; give these room.
const SLOW = 30_000;

describe('vault encryption', () => {
  it(
    'round-trips a payload',
    async () => {
      const secret = JSON.stringify({ note: 'Let $s = \\sigma + it$. Suppose $\\zeta(s)=0$.' });
      const env = await encrypt(secret, 'correct horse battery staple');
      expect(await decrypt(env, 'correct horse battery staple')).toBe(secret);
    },
    SLOW,
  );

  it(
    'rejects the wrong passphrase',
    async () => {
      const env = await encrypt('sensitive', 'passphrase one');
      await expect(decrypt(env, 'passphrase two')).rejects.toBeInstanceOf(WrongPassphraseError);
    },
    SLOW,
  );

  it(
    'rejects a tampered ciphertext (GCM is authenticated)',
    async () => {
      const env = await encrypt('sensitive', 'passphrase one');
      const bytes = atob(env.ciphertext).split('');
      bytes[0] = String.fromCharCode(bytes[0]!.charCodeAt(0) ^ 0xff);
      const tampered = { ...env, ciphertext: btoa(bytes.join('')) };
      await expect(decrypt(tampered, 'passphrase one')).rejects.toBeInstanceOf(WrongPassphraseError);
    },
    SLOW,
  );

  it(
    'never produces the same ciphertext twice for the same input',
    async () => {
      const a = await encrypt('same text', 'same passphrase');
      const b = await encrypt('same text', 'same passphrase');
      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(a.salt).not.toBe(b.salt);
      expect(a.iv).not.toBe(b.iv);
    },
    SLOW,
  );

  it(
    'records its parameters in the envelope so they can be raised later',
    async () => {
      const env = await encrypt('x', 'passphrase');
      expect(env.alg).toBe('AES-GCM-256');
      expect(env.kdf).toBe('PBKDF2-SHA256');
      expect(env.iterations).toBe(PBKDF2_ITERATIONS);
      expect(env.iterations).toBeGreaterThanOrEqual(600_000);
      // 12-byte IV, base64 of 12 bytes is 16 chars.
      expect(atob(env.iv)).toHaveLength(12);
      expect(atob(env.salt)).toHaveLength(16);
    },
    SLOW,
  );

  it('refuses an empty passphrase', async () => {
    await expect(encrypt('x', '')).rejects.toThrow();
  });

  it(
    'handles a large payload without corrupting it',
    async () => {
      const big = 'x'.repeat(200_000);
      const env = await encrypt(big, 'passphrase');
      expect(await decrypt(env, 'passphrase')).toBe(big);
    },
    SLOW,
  );
});

describe('assessPassphrase', () => {
  it('calls out short passphrases', () => {
    expect(assessPassphrase('abc').bucket).toBe('too short');
    expect(assessPassphrase('abcdefgh').bucket).toBe('weak');
  });

  it('prefers length over symbol soup', () => {
    expect(assessPassphrase('correct horse battery staple').bucket).toBe('strong');
    expect(assessPassphrase('Tr0ub4dor&3').bucket).toBe('reasonable');
  });
});

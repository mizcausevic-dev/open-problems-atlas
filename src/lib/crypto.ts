/**
 * Passphrase-encrypted local vault.
 *
 * What this actually is, stated precisely because the category is full of
 * overclaiming: AES-256-GCM encryption of the user's own notes, with a key
 * derived from a passphrase by PBKDF2-HMAC-SHA-256, performed in the browser.
 * The ciphertext is what gets written to localStorage and what an export file
 * contains. The passphrase is never stored and never leaves the page.
 *
 * What it is NOT: end-to-end encryption. E2E describes a message in transit
 * between two parties, and this app has no server and no second party. Calling
 * a local vault "E2E encrypted" would be marketing, not a security property.
 *
 * Threat model it does cover: someone with read access to this browser profile
 * (a shared machine, a synced backup, a stolen export file) cannot read the
 * notes without the passphrase.
 *
 * Threat model it does NOT cover: malicious code running in this page, a
 * compromised browser or OS, or a keylogger. Nothing client-side can.
 */

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA-256. Stored per-envelope so it can be raised later. */
export const PBKDF2_ITERATIONS = 600_000;

export const VAULT_VERSION = 1 as const;

export interface Envelope {
  v: typeof VAULT_VERSION;
  alg: 'AES-GCM-256';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  /** base64 */
  salt: string;
  /** base64, 12 bytes as required for GCM */
  iv: string;
  /** base64 */
  ciphertext: string;
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('Could not decrypt: wrong passphrase, or the vault file is damaged.');
    this.name = 'WrongPassphraseError';
  }
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      'Web Crypto is unavailable. The vault needs a secure context (https:// or localhost).',
    );
  }
  return c.subtle;
}

export function isAvailable(): boolean {
  return Boolean(globalThis.crypto?.subtle);
}

const toB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let s = '';
  // Chunked so a large vault does not blow the argument limit of fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

const fromB64 = (b64: string): Uint8Array => {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
};

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(plaintext: string, passphrase: string): Promise<Envelope> {
  if (!passphrase) throw new Error('A passphrase is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);

  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    v: VAULT_VERSION,
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toB64(salt.buffer as ArrayBuffer),
    iv: toB64(iv.buffer as ArrayBuffer),
    ciphertext: toB64(ciphertext),
  };
}

export async function decrypt(envelope: Envelope, passphrase: string): Promise<string> {
  if (envelope.v !== VAULT_VERSION) {
    throw new Error(`Unsupported vault version ${envelope.v}.`);
  }
  const salt = fromB64(envelope.salt);
  const iv = fromB64(envelope.iv);
  const key = await deriveKey(passphrase, salt, envelope.iterations);

  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      fromB64(envelope.ciphertext) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    // GCM authentication failure. Indistinguishable from tampering by design,
    // so the message covers both cases rather than guessing which happened.
    throw new WrongPassphraseError();
  }
}

/**
 * A coarse, honest passphrase assessment.
 *
 * Deliberately not a percentage or a "strong!" badge: those imply a precision
 * this cannot have. It reports the length and character-class facts and a
 * conservative bucket, and says outright that a short passphrase is the weak
 * link regardless of the cipher underneath.
 */
export function assessPassphrase(p: string): {
  bucket: 'too short' | 'weak' | 'reasonable' | 'strong';
  note: string;
} {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(p)).length;
  const words = p.trim().split(/\s+/).filter(Boolean).length;

  if (p.length < 8) {
    return { bucket: 'too short', note: 'Under 8 characters is guessable offline in seconds.' };
  }
  if (p.length < 12 && classes < 3) {
    return { bucket: 'weak', note: 'Short and low variety. A passphrase of several words is stronger than a short complex one.' };
  }
  if (words >= 4 || p.length >= 20) {
    return { bucket: 'strong', note: 'Long enough that the key derivation is doing real work.' };
  }
  return { bucket: 'reasonable', note: 'Acceptable. Four or more unrelated words would be better.' };
}

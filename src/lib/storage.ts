/**
 * The user's data store.
 *
 * A small observable over localStorage, consumed by React through
 * useSyncExternalStore. No context provider, no reducer boilerplate: there is
 * exactly one store, it is synchronous, and every mutation ends in a save.
 *
 * Two storage modes:
 *   plain  - UserData is written as JSON. Readable by anything with access to
 *            this browser profile. This is the default and it is stated as such
 *            in the UI.
 *   vault  - UserData is written as a crypto.ts Envelope. The plaintext exists
 *            only in memory while unlocked.
 *
 * There is deliberately no third "cloud" mode. See ABOUT in the app.
 */

import type { JournalEntry, TrackedProblem, TrackState, UserData } from '../types';
import type { Attachment } from './attachments';
import {
  attachmentChars, totalAttachmentChars, MAX_ATTACHMENTS_PER_ENTRY, MAX_TOTAL_ATTACHMENT_CHARS,
} from './attachments';
import type { Envelope } from './crypto';
import { encrypt, decrypt } from './crypto';

const KEY_DATA = 'opa.userdata.v1';
const KEY_VAULT = 'opa.vault.v1';
const KEY_MODE = 'opa.mode.v1';

/** Revisions kept per journal entry. Older ones are dropped on save. */
export const MAX_REVISIONS = 20;

export type StorageMode = 'plain' | 'vault';

export type VaultState =
  | { kind: 'plain' }
  | { kind: 'locked' }
  | { kind: 'unlocked' };

const emptyData = (): UserData => ({
  schemaVersion: 1,
  tracked: {},
  journal: [],
  updatedAt: new Date().toISOString(),
});

const nowISO = () => new Date().toISOString();

/** crypto.randomUUID needs a secure context; fall back without pretending otherwise. */
function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class Store {
  private data: UserData = emptyData();
  private mode: StorageMode = 'plain';
  private locked = false;
  private passphrase: string | null = null;
  private listeners = new Set<() => void>();
  /** Bumped on every change so useSyncExternalStore sees a new snapshot identity. */
  private version = 0;

  constructor() {
    this.hydrate();
  }

  private hydrate() {
    try {
      this.mode = (localStorage.getItem(KEY_MODE) as StorageMode) ?? 'plain';
      if (this.mode === 'vault') {
        this.locked = Boolean(localStorage.getItem(KEY_VAULT));
        return;
      }
      const raw = localStorage.getItem(KEY_DATA);
      if (raw) this.data = this.migrate(JSON.parse(raw));
    } catch (err) {
      // A corrupt or unreadable store must not white-screen the app. Start
      // empty and leave the bad value in place so it can still be recovered.
      console.warn('Could not read saved data; starting empty.', err);
    }
  }

  private migrate(raw: unknown): UserData {
    const d = raw as Partial<UserData>;
    if (!d || typeof d !== 'object') return emptyData();
    return {
      schemaVersion: 1,
      tracked: d.tracked ?? {},
      journal: Array.isArray(d.journal) ? d.journal : [],
      updatedAt: d.updatedAt ?? nowISO(),
    };
  }

  // -- subscription -------------------------------------------------------

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): number => this.version;

  private changed() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  // -- persistence --------------------------------------------------------

  /**
   * Last save failure, or null. Read by the UI so a failed write is visible.
   *
   * This used to be a console.warn and nothing else, which was survivable while
   * the only content was text. Attachments changed that: images are the reason a
   * browser actually hits its storage quota, and a silent failure means the user
   * writes a note, sees it on screen, and loses it on reload with no indication
   * anything went wrong. A save that did not happen has to be visible.
   */
  private saveError: string | null = null;

  get lastSaveError(): string | null {
    return this.saveError;
  }

  clearSaveError() {
    if (this.saveError === null) return;
    this.saveError = null;
    this.changed();
  }

  private failSave(err: unknown) {
    const quota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    this.saveError = quota
      ? 'Out of browser storage. Recent changes are not saved. Remove an attachment or delete an old note, then edit again to retry.'
      : 'Could not save to this browser. Recent changes are not saved.';

    console.warn('[storage] save failed', err);
    this.changed();
  }

  private persist() {
    this.data.updatedAt = nowISO();

    if (this.mode === 'vault') {
      if (!this.passphrase) return; // locked: nothing to write
      // The write is inside the promise, so its failure must be caught inside
      // the promise too. A try/catch around this call catches nothing — that was
      // the original bug, and it made vault-mode quota errors completely silent.
      void encrypt(JSON.stringify(this.data), this.passphrase)
        .then((env) => {
          localStorage.setItem(KEY_VAULT, JSON.stringify(env));
          this.clearSaveError();
        })
        .catch((err) => this.failSave(err));
    } else {
      try {
        localStorage.setItem(KEY_DATA, JSON.stringify(this.data));
        this.clearSaveError();
      } catch (err) {
        this.failSave(err);
      }
    }

    this.changed();
  }

  // -- reads --------------------------------------------------------------

  get vaultState(): VaultState {
    if (this.mode === 'plain') return { kind: 'plain' };
    return this.locked ? { kind: 'locked' } : { kind: 'unlocked' };
  }

  get storageMode(): StorageMode {
    return this.mode;
  }

  /** True when there is user data the UI should offer to protect or export. */
  get hasData(): boolean {
    return Object.keys(this.data.tracked).length > 0 || this.data.journal.length > 0;
  }

  all(): UserData {
    return this.data;
  }

  tracked(problemId: string): TrackedProblem | undefined {
    return this.data.tracked[problemId];
  }

  trackedList(): TrackedProblem[] {
    return Object.values(this.data.tracked);
  }

  journalFor(problemId: string): JournalEntry[] {
    return this.data.journal
      .filter((e) => e.problemId === problemId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  journalAll(): JournalEntry[] {
    return [...this.data.journal].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  // -- tracking -----------------------------------------------------------

  setTrackState(problemId: string, state: TrackState) {
    if (state === 'untracked') {
      delete this.data.tracked[problemId];
    } else {
      const existing = this.data.tracked[problemId];
      this.data.tracked[problemId] = {
        problemId,
        state,
        ...(existing?.perceivedDifficulty !== undefined
          ? { perceivedDifficulty: existing.perceivedDifficulty }
          : {}),
        ...(existing?.minutesLogged !== undefined ? { minutesLogged: existing.minutesLogged } : {}),
        createdAt: existing?.createdAt ?? nowISO(),
        updatedAt: nowISO(),
      };
    }
    this.persist();
  }

  setPerceivedDifficulty(problemId: string, value: number | undefined) {
    const t = this.data.tracked[problemId];
    if (!t) return;
    if (value === undefined) delete t.perceivedDifficulty;
    else t.perceivedDifficulty = Math.min(5, Math.max(1, Math.round(value)));
    t.updatedAt = nowISO();
    this.persist();
  }

  addMinutes(problemId: string, minutes: number) {
    const t = this.data.tracked[problemId];
    if (!t || !Number.isFinite(minutes) || minutes <= 0) return;
    t.minutesLogged = (t.minutesLogged ?? 0) + Math.round(minutes);
    t.updatedAt = nowISO();
    this.persist();
  }

  // -- journal ------------------------------------------------------------

  createEntry(problemId: string, title: string, body = ''): JournalEntry {
    const entry: JournalEntry = {
      id: newId(),
      problemId,
      title: title.trim() || 'Untitled note',
      body,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      revisions: [],
    };
    this.data.journal.push(entry);
    this.persist();
    return entry;
  }

  updateEntry(id: string, patch: { title?: string; body?: string }) {
    const entry = this.data.journal.find((e) => e.id === id);
    if (!entry) return;

    // Only snapshot when the body actually changed, so revisions track edits
    // rather than counting saves.
    if (patch.body !== undefined && patch.body !== entry.body) {
      entry.revisions.unshift({ body: entry.body, savedAt: entry.updatedAt });
      entry.revisions = entry.revisions.slice(0, MAX_REVISIONS);
      entry.body = patch.body;
    }
    if (patch.title !== undefined) entry.title = patch.title;
    entry.updatedAt = nowISO();
    this.persist();
  }

  restoreRevision(id: string, index: number) {
    const entry = this.data.journal.find((e) => e.id === id);
    const rev = entry?.revisions[index];
    if (!entry || !rev) return;
    this.updateEntry(id, { body: rev.body });
  }

  deleteEntry(id: string) {
    this.data.journal = this.data.journal.filter((e) => e.id !== id);
    this.persist();
  }

  // -- attachments --------------------------------------------------------

  /**
   * Budget checks live here rather than in the component.
   *
   * The limit is a property of the store's medium — one localStorage quota
   * shared by every note — so a per-editor check would be counting the wrong
   * thing. An editor only knows about the note in front of it, and eleven notes
   * each individually under the limit still exhaust the quota together.
   */
  attachmentUsage(): { used: number; total: number; fraction: number } {
    const used = totalAttachmentChars(this.data.journal);
    return { used, total: MAX_TOTAL_ATTACHMENT_CHARS, fraction: used / MAX_TOTAL_ATTACHMENT_CHARS };
  }

  addAttachment(entryId: string, attachment: Attachment): { ok: true } | { ok: false; reason: string } {
    const entry = this.data.journal.find((e) => e.id === entryId);
    if (!entry) return { ok: false, reason: 'That note no longer exists.' };

    const existing = entry.attachments ?? [];
    if (existing.length >= MAX_ATTACHMENTS_PER_ENTRY) {
      return {
        ok: false,
        reason: `A note holds at most ${MAX_ATTACHMENTS_PER_ENTRY} attachments. Start a second note for the rest.`,
      };
    }

    const { used, total } = this.attachmentUsage();
    if (used + attachmentChars(attachment) > total) {
      return {
        ok: false,
        reason:
          'This would exceed the space the browser gives this site. Remove an attachment from another note first.',
      };
    }

    entry.attachments = [...existing, attachment];
    entry.updatedAt = nowISO();
    this.persist();

    // persist() reports quota failures asynchronously in vault mode, so a true
    // return here means "accepted", not "written". lastSaveError is the source
    // of truth for whether it actually landed, and the editor surfaces it.
    return { ok: true };
  }

  updateAttachment(entryId: string, attachmentId: string, patch: { caption?: string }) {
    const entry = this.data.journal.find((e) => e.id === entryId);
    const att = entry?.attachments?.find((a) => a.id === attachmentId);
    if (!entry || !att) return;
    if (patch.caption !== undefined) att.caption = patch.caption;
    entry.updatedAt = nowISO();
    this.persist();
  }

  removeAttachment(entryId: string, attachmentId: string) {
    const entry = this.data.journal.find((e) => e.id === entryId);
    if (!entry?.attachments) return;
    entry.attachments = entry.attachments.filter((a) => a.id !== attachmentId);
    entry.updatedAt = nowISO();
    this.persist();
  }

  // -- vault --------------------------------------------------------------

  async enableVault(passphrase: string) {
    const env = await encrypt(JSON.stringify(this.data), passphrase);
    localStorage.setItem(KEY_VAULT, JSON.stringify(env));
    localStorage.removeItem(KEY_DATA);
    localStorage.setItem(KEY_MODE, 'vault');
    this.mode = 'vault';
    this.passphrase = passphrase;
    this.locked = false;
    this.changed();
  }

  async unlock(passphrase: string) {
    const raw = localStorage.getItem(KEY_VAULT);
    if (!raw) throw new Error('No vault found in this browser.');
    const env = JSON.parse(raw) as Envelope;
    const plain = await decrypt(env, passphrase); // throws WrongPassphraseError
    this.data = this.migrate(JSON.parse(plain));
    this.passphrase = passphrase;
    this.locked = false;
    this.changed();
  }

  lock() {
    if (this.mode !== 'vault') return;
    this.data = emptyData();
    this.passphrase = null;
    this.locked = true;
    this.changed();
  }

  /** Turn the vault off, writing the current data back out as plain JSON. */
  async disableVault(passphrase: string) {
    if (this.locked) await this.unlock(passphrase);
    localStorage.removeItem(KEY_VAULT);
    localStorage.setItem(KEY_MODE, 'plain');
    this.mode = 'plain';
    this.passphrase = null;
    this.persist();
  }

  // -- bulk ---------------------------------------------------------------

  replaceAll(data: UserData) {
    this.data = this.migrate(data);
    this.persist();
  }

  /** Merge an imported file into the current data. Newer updatedAt wins. */
  mergeIn(incoming: UserData): { tracked: number; journal: number } {
    const merged = this.migrate(incoming);
    let trackedCount = 0;
    let journalCount = 0;

    for (const [id, t] of Object.entries(merged.tracked)) {
      const mine = this.data.tracked[id];
      if (!mine || t.updatedAt > mine.updatedAt) {
        this.data.tracked[id] = t;
        trackedCount++;
      }
    }
    for (const entry of merged.journal) {
      const mine = this.data.journal.find((e) => e.id === entry.id);
      if (!mine) {
        this.data.journal.push(entry);
        journalCount++;
      } else if (entry.updatedAt > mine.updatedAt) {
        Object.assign(mine, entry);
        journalCount++;
      }
    }
    this.persist();
    return { tracked: trackedCount, journal: journalCount };
  }

  clearAll() {
    this.data = emptyData();
    try {
      localStorage.removeItem(KEY_DATA);
      localStorage.removeItem(KEY_VAULT);
      localStorage.removeItem(KEY_MODE);
    } catch { /* ignore */ }
    this.mode = 'plain';
    this.passphrase = null;
    this.locked = false;
    this.changed();
  }
}

export const store = new Store();

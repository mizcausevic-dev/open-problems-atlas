/**
 * Journal, vault and data portability.
 *
 * This page is where the app has to be most careful about what it claims. The
 * original brief asked for cloud sync, automated backups and end-to-end
 * encryption. What is actually here:
 *
 *   - real: AES-256-GCM encryption of your notes at rest, with a
 *     passphrase-derived key that never leaves the page
 *   - real: export to JSON, LaTeX, Markdown and PDF, and import back
 *   - not built: cloud sync, scheduled backups, shared workspaces
 *
 * The third list is on the About page rather than hidden, because a backup
 * schedule that does not run is worse than no backup schedule.
 */

import { useRef, useState } from 'react';
import {
  AlertTriangle, Download, FileJson, FileText, Lock, LockOpen, Printer, ShieldCheck, Trash2, Upload,
} from 'lucide-react';
import type { Dataset } from '../types';
import { store } from '../lib/storage';
import { assessPassphrase, isAvailable as cryptoAvailable, WrongPassphraseError } from '../lib/crypto';
import { download, filenameStamp, ImportError, parseBackup, toBackup, toLaTeX, toMarkdown } from '../lib/export';
import { Button, EmptyState, Note, Panel, SectionTitle, fmt } from '../components/ui';
import { NoteBody } from '../components/Tex';

interface Props {
  dataset: Dataset;
  onOpen: (id: string) => void;
}

export default function JournalView({ dataset, onOpen }: Props) {
  const notes = store.journalAll();
  const data = store.all();
  const vault = store.vaultState;

  if (vault.kind === 'locked') return <UnlockScreen />;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Journal and data
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          {fmt.format(notes.length)} {notes.length === 1 ? 'note' : 'notes'} across{' '}
          {new Set(notes.map((n) => n.problemId)).size} problems, plus{' '}
          {fmt.format(Object.keys(data.tracked).length)} tracked problems. All of it lives in this
          browser.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel className="p-4 sm:p-5">
            <SectionTitle
              hint="Newest first"
              right={
                notes.length > 0 && (
                  <Button size="sm" onClick={() => window.print()} title="Opens the browser print dialogue; choose Save as PDF">
                    <Printer className="size-3.5" aria-hidden /> Print / PDF
                  </Button>
                )
              }
            >
              All notes
            </SectionTitle>

            {notes.length === 0 ? (
              <EmptyState icon={<FileText className="size-8" />} title="No notes yet">
                Notes are written from a problem's page. They are plain text with LaTeX between
                dollar signs, and every edit keeps the previous version.
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => {
                  const p = dataset.problems.find((x) => x.id === n.problemId);
                  return (
                    <li key={n.id} className="rounded-xl border border-line bg-panel-2 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold text-ink-strong">{n.title}</h3>
                        <span className="font-mono text-[11px] text-ink-dim">
                          {n.updatedAt.slice(0, 10)}
                          {n.revisions.length > 0 && ` · ${n.revisions.length} earlier`}
                        </span>
                      </div>
                      {p && (
                        <button
                          type="button"
                          onClick={() => onOpen(p.id)}
                          className="mt-0.5 text-xs text-accent hover:underline"
                        >
                          {p.title}
                        </button>
                      )}
                      {n.body.trim() ? (
                        <NoteBody className="mt-2 text-sm text-ink">{n.body}</NoteBody>
                      ) : (
                        <p className="mt-2 text-sm text-ink-dim italic">Empty.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5" data-print="hide">
          <VaultPanel />
          <ExportPanel dataset={dataset} />
          <DangerPanel />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UnlockScreen() {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await store.unlock(passphrase);
      setPassphrase('');
    } catch (err) {
      setError(
        err instanceof WrongPassphraseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not unlock.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-12">
      <Panel className="p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <Lock className="size-5 text-accent" aria-hidden />
          <h1 className="text-lg font-semibold text-ink-strong">Vault locked</h1>
        </div>
        <p className="mb-4 text-sm text-ink-dim">
          Your notes and tracking are encrypted in this browser's storage. Enter the passphrase to
          decrypt them.
        </p>
        <form onSubmit={unlock} className="space-y-3">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="current-password"
            aria-label="Vault passphrase"
            placeholder="Passphrase"
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          {error && (
            <p className="flex items-start gap-1.5 text-sm text-danger" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={busy || !passphrase} className="w-full">
            {busy ? 'Deriving key…' : 'Unlock'}
          </Button>
        </form>
        <Note>
          Key derivation runs 600,000 PBKDF2-SHA256 iterations, the current OWASP floor. Whatever
          pause you notice when unlocking is that work, and it is the point: it is the same cost an
          attacker pays on every guess.
        </Note>
        <Note tone="warn">
          There is no recovery. No server holds a copy and no reset link exists, because there is no
          account. A forgotten passphrase means the notes are gone.
        </Note>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------

function VaultPanel() {
  const vault = store.vaultState;
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const available = cryptoAvailable();
  const assessment = passphrase ? assessPassphrase(passphrase) : null;

  const enable = async () => {
    if (passphrase !== confirm) {
      setError('The two passphrases do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await store.enableVault(passphrase);
      setPassphrase('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable the vault.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-4">
      <SectionTitle hint="AES-256-GCM, key derived from your passphrase in this page">
        Encrypted vault
      </SectionTitle>

      {!available ? (
        <Note tone="warn">
          Web Crypto is unavailable here. The vault needs a secure context, meaning https:// or
          localhost. Opening the built files directly from disk will not do.
        </Note>
      ) : vault.kind === 'unlocked' ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-solved">
            <ShieldCheck className="size-4" aria-hidden />
            On. Your data is stored as ciphertext.
          </p>
          <Button size="sm" onClick={() => store.lock()}>
            <Lock className="size-3.5" aria-hidden /> Lock now
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-ink-dim">
            <LockOpen className="size-4" aria-hidden />
            Off. Notes are stored as readable JSON in this browser.
          </p>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="new-password"
            aria-label="New vault passphrase"
            placeholder="Choose a passphrase"
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-label="Confirm vault passphrase"
            placeholder="Type it again"
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
          {assessment && (
            <p className="text-xs text-ink-dim">
              <span className="font-medium text-ink">{assessment.bucket}</span> — {assessment.note}
            </p>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={enable}
            disabled={busy || passphrase.length < 8 || !confirm}
          >
            {busy ? 'Encrypting…' : 'Turn the vault on'}
          </Button>
          <Note>
            This protects the notes against anyone who can read this browser profile: a shared
            machine, a synced backup, a copied export. It is not end-to-end encryption, because
            there is no second end. It cannot protect against code running inside this page.
          </Note>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function ExportPanel({ dataset }: { dataset: Dataset }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const data = store.all();

  const doImport = async (file: File) => {
    try {
      const incoming = parseBackup(await file.text());
      const { tracked, journal } = store.mergeIn(incoming);
      setMessage(
        `Merged ${tracked} tracked ${tracked === 1 ? 'problem' : 'problems'} and ${journal} ${journal === 1 ? 'note' : 'notes'}. Newer records won where both files had one.`,
      );
    } catch (err) {
      setMessage(err instanceof ImportError ? err.message : 'Could not read that file.');
    }
  };

  return (
    <Panel className="p-4">
      <SectionTitle hint="Files you can open without this app">Export and import</SectionTitle>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          onClick={() =>
            download(`atlas-backup-${filenameStamp()}.json`, JSON.stringify(toBackup(data), null, 2), 'application/json')
          }
        >
          <FileJson className="size-3.5" aria-hidden /> JSON
        </Button>
        <Button
          size="sm"
          onClick={() => download(`research-journal-${filenameStamp()}.tex`, toLaTeX(data, dataset.problems), 'application/x-tex')}
        >
          <FileText className="size-3.5" aria-hidden /> LaTeX
        </Button>
        <Button
          size="sm"
          onClick={() => download(`research-journal-${filenameStamp()}.md`, toMarkdown(data, dataset.problems), 'text/markdown')}
        >
          <Download className="size-3.5" aria-hidden /> Markdown
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden /> PDF
        </Button>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = '';
          }}
        />
        <Button size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="size-3.5" aria-hidden /> Import a JSON backup
        </Button>
        {message && (
          <p className="mt-2 text-xs text-ink-dim" role="status">
            {message}
          </p>
        )}
      </div>

      <Note>
        The JSON file is the complete record and re-imports cleanly. The .tex file compiles with a
        stock LaTeX distribution and no extra packages. PDF goes through the browser's own print
        pipeline, which is why there is no PDF library in this bundle.
      </Note>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function DangerPanel() {
  const [confirming, setConfirming] = useState(false);

  return (
    <Panel className="border-danger/30 p-4">
      <SectionTitle hint="No server holds a copy of any of this">Erase everything</SectionTitle>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-danger">
            This deletes every tracked problem, every note and every revision in this browser, and
            it cannot be undone. Export a backup first if you want one.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                store.clearAll();
                setConfirming(false);
              }}
            >
              <Trash2 className="size-3.5" aria-hidden /> Yes, erase it
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          <Trash2 className="size-3.5" aria-hidden /> Erase all local data
        </Button>
      )}
    </Panel>
  );
}

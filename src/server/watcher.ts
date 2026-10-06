import { createHash } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import { basename, join, sep } from 'node:path';
import { discoverIssues, excluded } from './discovery.js';

export type BoardWatcher = {
  /** Increases each time the discovered board differs from the previously published one. */
  version: () => number;
  /** Calls the listener with the new version after each board change; returns an unsubscribe function. */
  subscribe: (listener: (version: number) => void) => () => void;
  close: () => void;
};
export type BoardWatcherOptions = { pollMs?: number; native?: boolean };

const debounceMs = 100;

// Include ordinary linked Markdown as well as listed supporting documents. Stat fingerprints avoid
// reading document contents here; the document API still owns safe reads and the selected-root boundary.
async function markdownVersions(folder: string): Promise<unknown[]> {
  const versions: unknown[] = [];
  async function walk(directory: string) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.mdboard-') || (excluded.has(entry.name) && entry.name !== 'adr')) continue;
      const path = join(directory, entry.name);
      try {
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          const stat = await lstat(path);
          if (!stat.isSymbolicLink()) versions.push([path, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs]);
        }
      } catch { versions.push([path, 'unavailable']); }
    }
  }
  await walk(folder);
  return versions;
}
const fingerprintOf = async (folder: string): Promise<string> => {
  try { return createHash('sha256').update(JSON.stringify([await discoverIssues(folder), await markdownVersions(folder)])).digest('hex'); }
  catch { return 'unavailable'; }
};

/**
 * Observes the selected folder and reports issue or supporting Markdown changes.
 * Events are hints: every burst is debounced and the board is rediscovered, so atomic replacements,
 * renames, and writes by other tools converge on the same result, and non-Markdown files publish nothing.
 * Falls back to polling when recursive native watching is unavailable or fails.
 */
export async function createBoardWatcher(folder: string, options: BoardWatcherOptions = {}): Promise<BoardWatcher> {
  const { pollMs = 1000, native = true } = options;
  const root = await realpath(folder);
  const listeners = new Set<(version: number) => void>();
  let version = 0;
  let fingerprint: string | null = null;
  let closed = false;
  let scanning = false;
  let rescan = false;
  let timer: NodeJS.Timeout | undefined;
  let poller: NodeJS.Timeout | undefined;
  let watcher: FSWatcher | undefined;

  async function scan(): Promise<void> {
    if (closed) return;
    if (scanning) { rescan = true; return; }
    scanning = true;
    try {
      do {
        rescan = false;
        const next = await fingerprintOf(folder);
        if (closed) return;
        // A native watcher can die silently when the root is removed or replaced; polling recovers from that.
        if (next === 'unavailable') startPolling();
        const baseline = fingerprint === null;
        if (next !== fingerprint) {
          fingerprint = next;
          if (!baseline) { version += 1; for (const listener of [...listeners]) listener(version); }
        }
      } while (rescan);
    } finally { scanning = false; }
  }
  const schedule = (): void => {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void scan(); }, debounceMs);
    timer.unref();
  };
  const startPolling = (): void => {
    if (closed || poller) return;
    watcher?.close();
    watcher = undefined;
    poller = setInterval(() => { void scan(); }, pollMs);
    poller.unref();
  };
  // Lock and temporary files from our own writes never affect discovery.
  const relevant = (filename: string | null): boolean => filename === null ||
    (!basename(filename).startsWith('.mdboard-') && !filename.split(sep).some((part) => (excluded.has(part) && part !== 'adr')));

  if (native) {
    try {
      watcher = watch(root, { recursive: true }, (_event, filename) => { if (relevant(filename)) schedule(); });
      watcher.on('error', startPolling);
    } catch { startPolling(); }
  } else startPolling();
  // Start observing before the baseline so a change during the first scan is not missed.
  await scan();
  return {
    version: () => version,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    close() {
      closed = true;
      clearTimeout(timer);
      clearInterval(poller);
      watcher?.close();
      watcher = undefined;
      listeners.clear();
    },
  };
}

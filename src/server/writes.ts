import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { issueWriteSchema, type Issue, type StatusChange } from './board.js';
import { DocumentError, readDocument } from './documents.js';
import { parseIssue } from './issues.js';

export class WriteError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
const conflict = (): WriteError => new WriteError(409, 'stale_revision', 'This issue changed on disk. Reload issues, review the latest version, and try again.');
const revision = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
// All mutations share this queue, including multiple sessions served by this process.
const pending = new Map<string, Promise<unknown>>();

export async function createIssueWriter(folder: string) {
  const root = await realpath(folder);
  async function checkPath(path: string) {
    if (path !== root && !path.startsWith(root + sep)) throw new WriteError(400, 'invalid_path', 'Issue path is outside the selected folder.');
    let current = root;
    for (const part of [null, ...relative(root, path).split(sep).filter(Boolean)]) {
      if (part !== null) current = join(current, part);
      if (part === '.git' || (await lstat(current)).isSymbolicLink()) throw new WriteError(400, 'invalid_path', 'Symbolic links cannot be edited. Reload issues.');
    }
    if (await realpath(path) !== path) throw new WriteError(400, 'invalid_path', 'Issue path changed. Reload issues.');
  }
  async function readCurrent(path: string, expected: string) {
    await checkPath(path);
    const handle = await open(path, constants.O_RDWR | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (!opened.isFile()) throw new WriteError(400, 'invalid_path', 'Only regular Markdown files can be edited.');
      if (opened.size > 2 * 1024 * 1024) throw new WriteError(413, 'preview_limit', 'Document exceeds the 2 MiB preview limit.');
      const buffer = Buffer.allocUnsafe(2 * 1024 * 1024 + 1);
      let length = 0;
      while (length < buffer.length) { const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null); if (!bytesRead) break; length += bytesRead; }
      if (length === buffer.length) throw new WriteError(413, 'preview_limit', 'Document exceeds the 2 MiB preview limit.');
      const bytes = buffer.subarray(0, length);
      await checkPath(path);
      const checked = await lstat(path);
      if (!opened.isFile() || opened.dev !== checked.dev || opened.ino !== checked.ino || revision(bytes) !== expected) throw conflict();
      // Reject non-UTF-8 instead of changing bytes through replacement characters.
      if (!Buffer.from(bytes.toString('utf8')).equals(bytes)) throw new WriteError(422, 'invalid_encoding', 'Cannot safely edit this issue: save it as UTF-8 and reload.');
      return { bytes, stat: opened };
    } finally { await handle.close(); }
  }

  return {
    // Later field/body/comment edits reuse the same revision check and filesystem transaction.
    update(request: Pick<StatusChange, 'path' | 'expectedRevision'>, transform: (issue: Issue) => string, allowDiagnostics = false): Promise<Issue> {
      const validated = issueWriteSchema.safeParse(request);
      if (!validated.success) return Promise.reject(new WriteError(400, 'invalid_request', 'Supply a root-relative issue path and expected revision.'));
      request = validated.data;
      const path = join(root, request.path);
      const previous = pending.get(path) ?? Promise.resolve();
      const operation = previous.catch(() => {}).then(async () => {
        let temporary: string | undefined;
        let lock: string | undefined;
        try {
          // Authorize a readable Markdown identity independently of collection visibility/workflow.
          if (!/\.(md|markdown)$/i.test(request.path)) throw new WriteError(400, 'invalid_path', 'Only Markdown documents can be edited.');
          await readDocument(root, request.path);
          const container = relative(root, dirname(path)).split(sep).join('/') || '.';
          const featureDirectory = ['issues', 'tickets'].includes(basename(dirname(path))) ? dirname(dirname(path)) : dirname(path);
          const context = { path: request.path, container, feature: basename(featureDirectory), location: featureDirectory === root ? '.' : relative(root, dirname(featureDirectory)).split(sep).join('/') || '.' };
          await checkPath(path);
          const lockPath = join(dirname(path), `.mdboard-${createHash('sha256').update(basename(path)).digest('hex')}.lock`);
          try {
            const handle = await open(lockPath, 'wx', 0o600);
            lock = lockPath;
            await handle.close();
            await checkPath(lockPath);
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
              throw new WriteError(409, 'write_in_progress', 'Another app is saving this issue, or a save was interrupted. Wait and reload issues. If it persists, stop all mdboard processes and remove the .mdboard-*.lock file beside this issue before restarting.');
            }
            throw error;
          }
          const current = await readCurrent(path, request.expectedRevision);
          const issue = parseIssue(context, current.bytes.toString('utf8'));
          let content: string;
          try { content = transform(issue); }
          catch (error) { throw new WriteError(422, 'invalid_change', error instanceof Error ? error.message : 'Invalid issue change.'); }
          if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) throw new WriteError(413, 'preview_limit', 'Document exceeds the 2 MiB preview limit.');
          const saved = parseIssue(context, content);
          if (content === issue.content) return saved;
          await checkPath(dirname(path));
          temporary = join(dirname(path), `.mdboard-${randomUUID()}.tmp`);
          const handle = await open(temporary, 'wx', 0o600);
          try {
            await checkPath(temporary);
            const created = await handle.stat();
            const checked = await lstat(temporary);
            if (!created.isFile() || created.dev !== checked.dev || created.ino !== checked.ino) throw conflict();
            await handle.writeFile(content, 'utf8');
            await handle.chmod(current.stat.mode & 0o777);
            await handle.sync();
          } finally { await handle.close(); }
          const latest = await readCurrent(path, request.expectedRevision);
          if (latest.stat.dev !== current.stat.dev || latest.stat.ino !== current.stat.ino) throw conflict();
          await checkPath(temporary);
          await rename(temporary, path);
          temporary = undefined;
          return saved;
        } catch (error) {
          if (error instanceof WriteError) throw error;
          if (error instanceof DocumentError) throw new WriteError(error.status, 'document_unavailable', error.message);
          throw new WriteError(500, 'write_failed', 'Could not save the issue. Check folder access and that the issue still exists, then reload issues before retrying.');
        } finally {
          if (temporary) await unlink(temporary).catch(() => {});
          if (lock) await unlink(lock).catch(() => {});
        }
      });
      pending.set(path, operation);
      void operation.finally(() => { if (pending.get(path) === operation) pending.delete(path); }).catch(() => {});
      return operation;
    },
  };
}

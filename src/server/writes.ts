import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { issueWriteSchema, type Issue, type StatusChange } from './board.js';
import { discoverIssues } from './discovery.js';
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
      if ((await lstat(current)).isSymbolicLink()) throw new WriteError(400, 'invalid_path', 'Symbolic links cannot be edited. Reload issues.');
    }
    if (await realpath(path) !== path) throw new WriteError(400, 'invalid_path', 'Issue path changed. Reload issues.');
  }
  async function readCurrent(path: string, expected: string) {
    await checkPath(path);
    const handle = await open(path, constants.O_RDWR | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      const bytes = await handle.readFile();
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
    update(request: Pick<StatusChange, 'path' | 'expectedRevision'>, transform: (issue: Issue) => string): Promise<Issue> {
      const validated = issueWriteSchema.safeParse(request);
      if (!validated.success) return Promise.reject(new WriteError(400, 'invalid_request', 'Supply a root-relative issue path and expected revision.'));
      request = validated.data;
      const path = join(root, request.path);
      const previous = pending.get(path) ?? Promise.resolve();
      const operation = previous.catch(() => {}).then(async () => {
        let temporary: string | undefined;
        let lock: string | undefined;
        try {
          // Authorize discovered issue identities, never arbitrary Markdown/supporting documents.
          const board = await discoverIssues(root);
          const context = board.issues.find((issue) => issue.path === request.path);
          if (!context) throw new WriteError(404, 'issue_unavailable', 'Issue is unavailable in the selected folder. Reload issues and check its path.');
          await checkPath(path);
          const lockPath = join(dirname(path), `.md-kanban-${createHash('sha256').update(basename(path)).digest('hex')}.lock`);
          try {
            const handle = await open(lockPath, 'wx', 0o600);
            lock = lockPath;
            await handle.close();
            await checkPath(lockPath);
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
              throw new WriteError(409, 'write_in_progress', 'Another app is saving this issue, or a save was interrupted. Wait and reload issues. If it persists, stop all md-kanban processes and remove the .md-kanban-*.lock file beside this issue before restarting.');
            }
            throw error;
          }
          const current = await readCurrent(path, request.expectedRevision);
          const issue = parseIssue(context, current.bytes.toString('utf8'));
          if (!issue.workflow) throw new WriteError(422, 'needs_attention', 'Issue metadata needs attention. Check the Markdown and reload issues.');
          let content: string;
          try { content = transform(issue); }
          catch (error) { throw new WriteError(422, 'invalid_change', error instanceof Error ? error.message : 'Invalid issue change.'); }
          const saved = parseIssue(context, content);
          if (!saved.workflow) throw new WriteError(422, 'invalid_change', 'The change would produce invalid issue metadata.');
          if (content === issue.content) return saved;
          await checkPath(dirname(path));
          temporary = join(dirname(path), `.md-kanban-${randomUUID()}.tmp`);
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

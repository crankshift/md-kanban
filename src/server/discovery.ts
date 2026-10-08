import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { compareIssues, type BoardData, type IssueContext } from './board.js';
import { filenameNumber, numberedHeading, parseIssue } from './issues.js';

export const containers = new Set(['issues', 'tickets']);
export const excluded = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.cache', '.next', '.pnpm-store', '.agents', '.codex', 'adr', 'assets']);
const documents = /^(?:spec(?:ification)?|map|readme|agents|claude|glossary|implementation-(?:workflow|prompt.*))\.md$/i;
const portable = (path: string): string => path.split(sep).join('/');

/** How the selected folder was chosen: a repository root, a direct issue folder, or a feature/tracker folder. */
export async function classifyRoot(root: string): Promise<{ direct: boolean; repository: boolean }> {
  const top = await readdir(root, { withFileTypes: true });
  const selectedContainer = containers.has(basename(root));
  const hasDirectory = (names: string[]): boolean => top.some((entry) => names.includes(entry.name) && entry.isDirectory());
  const repository = !selectedContainer && !['docs', '.scratch'].includes(basename(root)) && hasDirectory(['.git', '.scratch', 'docs']);
  // A docs subfolder alone does not disqualify a directly selected issue folder.
  const direct = selectedContainer || (!hasDirectory(['.git', '.scratch', 'issues', 'tickets']) && !['docs', '.scratch'].includes(basename(root)));
  return { direct, repository };
}

export async function discoverIssues(folder: string): Promise<BoardData> {
  // The explicitly selected folder is the boundary, even when it was selected through a symlink.
  const root = await realpath(folder);
  const result: BoardData = { issues: [], warnings: [] };
  const seen = new Set<string>();
  const displayPath = (path: string): string => portable(relative(root, path)) || '.';
  const inside = (path: string): boolean => path === root || path.startsWith(root + sep);
  async function safePath(path: string): Promise<boolean> {
    // Refuse symlinks at every component, including an ancestor replaced since traversal.
    const parts = relative(root, path).split(sep).filter(Boolean);
    let current = root;
    for (const part of parts) {
      current = join(current, part);
      if ((await lstat(current)).isSymbolicLink()) return false;
    }
    return inside(await realpath(path));
  }
  function contextFor(directory: string, path: string): IssueContext {
    const featureDirectory = containers.has(basename(directory)) ? dirname(directory) : directory;
    return {
      path: displayPath(path), container: displayPath(directory),
      feature: basename(featureDirectory),
      location: inside(dirname(featureDirectory)) ? displayPath(dirname(featureDirectory)) : '.',
    };
  }
  async function visit(directory: string, direct: boolean, repository = false): Promise<void> {
    if (excluded.has(basename(directory))) return;
    let entries;
    try {
      if (!(await safePath(directory))) return;
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      result.warnings.push(`Cannot read directory: ${displayPath(directory)}. Check access and reload.`);
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink() || excluded.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (repository && !['.scratch', 'docs', 'issues', 'tickets'].includes(entry.name)) continue;
        await visit(path, containers.has(entry.name));
      } else if (entry.isFile() && direct && /\.md$/i.test(entry.name) && !documents.test(entry.name)) {
        const context = contextFor(directory, path);
        try {
          if (!(await safePath(path))) continue;
          const canonical = await realpath(path);
          if (seen.has(canonical)) continue;
          // O_NOFOLLOW also guards a file replaced by a symlink between checking and opening.
          const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
          let content: string;
          try {
            const opened = await handle.stat();
            if (!opened.isFile() || !(await safePath(path))) continue;
            if (opened.size > 2 * 1024 * 1024) throw new Error('Issue exceeds the preview limit');
            const checked = await lstat(path);
            if (checked.isSymbolicLink() || opened.dev !== checked.dev || opened.ino !== checked.ino) {
              throw new Error('Issue changed during discovery');
            }
            content = await handle.readFile('utf8');
          } finally { await handle.close(); }
          if (!filenameNumber(entry.name) && !numberedHeading(content)) continue;
          seen.add(canonical);
          result.issues.push(parseIssue(context, content));
        } catch {
          if (filenameNumber(entry.name)) {
            result.issues.push({
              ...context, id: context.path, number: filenameNumber(entry.name), title: entry.name,
              workflow: null, status: null, type: null, dependencyText: null, content: null, revision: null,
              diagnostics: ['Cannot read issue. Check access or reload after an external change.'],
            });
          }
        }
      }
    }
  }
  const { direct, repository } = await classifyRoot(root);
  await visit(root, direct, repository);
  result.issues.sort(compareIssues);
  return result;
}

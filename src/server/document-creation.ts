import { randomUUID } from 'node:crypto';
import { lstat, open, realpath, link, unlink, mkdir } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { z } from 'zod';
import { titleSchema, issueWriteSchema } from './board.js';
import { WriteError } from './writes.js';
import { readDocument } from './documents.js';

const folderSchema = z.union([z.literal(''), issueWriteSchema.shape.path]);
const nameSchema = z.string().min(1).max(240).refine(v => v.trim() === v && !/[\\/\x00-\x1f:]/.test(v) && !['.', '..', '.git'].includes(v.toLowerCase()) && !v.startsWith('.mdboard-'), 'Use one safe name without path separators.');
export const newDocumentSchema = z.object({ folder: folderSchema, filename: nameSchema.refine(v => /\.(md|markdown)$/i.test(v), 'Use a Markdown filename.'), title: titleSchema,
  status: z.string().trim().max(500).refine(v => !/[\x00-\x1f\x7f]/.test(v)).default(''), body: z.string().max(500_000).refine(v => !v.includes('\0')).default(''),
}).strict();
export const newFolderSchema = z.object({ parent: folderSchema, name: nameSchema }).strict();

/** Selected-root containment and every ancestor are checked before and after publication. */
async function safeDirectory(root: string, path: string) {
  if (!folderSchema.safeParse(path).success) throw new WriteError(400, 'invalid_path', 'Use a relative folder path.');
  let current = root;
  for (const part of [null, ...path.split('/').filter(Boolean)]) {
    if (part !== null) current = join(current, part);
    const stat = await lstat(current);
    if (part?.toLowerCase() === '.git' || !stat.isDirectory() || stat.isSymbolicLink()) throw new WriteError(400, 'invalid_path', 'Choose a real in-boundary folder, without symbolic links.');
  }
  if (await realpath(current) !== current || !(current === root || current.startsWith(root + sep))) throw new WriteError(400, 'invalid_path', 'The folder changed. Reload.');
  return current;
}
async function inFolder<T>(folder: string, path: string, action: (directory: string, check: () => Promise<void>) => Promise<T>): Promise<T> {
  const root = folder;
  let lock: string | undefined;
  try {
    const directory = await safeDirectory(root, path), before = await lstat(directory);
    const check = async () => { await safeDirectory(root, path); const now = await lstat(directory); if (now.dev !== before.dev || now.ino !== before.ino) throw new WriteError(409, 'folder_changed', 'The folder changed. Reload before retrying.'); };
    const name = join(directory, '.mdboard-create.lock');
    const handle = await open(name, 'wx', 0o600); lock = name; await handle.close();
    await check();
    return await action(directory, check);
  } catch (error) {
    if (error instanceof WriteError) throw error;
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') throw new WriteError(409, 'already_exists', 'The name already exists or another creation holds .mdboard-create.lock. Reload and review before retrying.');
    throw new WriteError(500, 'write_failed', 'Could not create in this folder. Check access and reload before retrying; your draft is retained.');
  } finally { if (lock) await unlink(lock).catch(() => {}); }
}

export async function createDocument(folder: string, input: unknown) {
  const parsed = newDocumentSchema.safeParse(input);
  if (!parsed.success) throw new WriteError(400, 'invalid_request', parsed.error.issues.map(i => i.message).join('; '));
  const draft = parsed.data;
  const path = [draft.folder, draft.filename].filter(Boolean).join('/');
  await inFolder(folder, draft.folder, async (directory, check) => {
    const content = '# ' + draft.title + '\n\n' + (draft.status ? 'Status: ' + draft.status + '\n\n' : '') + draft.body + (draft.body && !draft.body.endsWith('\n') ? '\n' : '');
    const temporary = join(directory, '.mdboard-' + randomUUID() + '.tmp');
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await check();
      const temp = await lstat(temporary);
      if (!temp.isFile() || temp.isSymbolicLink()) throw new WriteError(400, 'invalid_path', 'Temporary file changed.');
      await link(temporary, join(directory, draft.filename));
    } finally { await unlink(temporary).catch(() => {}); }
  });
  return readDocument(folder, path);
}

export async function createFolder(folder: string, input: unknown) {
  const parsed = newFolderSchema.safeParse(input);
  if (!parsed.success) throw new WriteError(400, 'invalid_request', 'Choose a parent and one safe folder name.');
  const { parent, name } = parsed.data;
  await inFolder(folder, parent, async (directory, check) => { await check(); await mkdir(join(directory, name), { mode: 0o700 }); await check(); });
  return { path: [parent, name].filter(Boolean).join('/') };
}

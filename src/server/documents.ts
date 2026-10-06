import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { basename, join, posix } from 'node:path';
import { issueWriteSchema } from './board.js';
import { type DocumentLink, type DocumentList, type OpenedDocument, type SupportingDocument } from './document-types.js';
import { classifyRoot, containers, discoverIssues } from './discovery.js';

export class DocumentError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

const maxBytes = 2 * 1024 * 1024;
const markdown = /\.(?:md|markdown)$/i;
const specification = /^(?:spec|specification)\.md$/i;
const map = /^map\.md$/i;
// Dependency and repository-internal folders are never browsable, even through a link.
const denied = new Set(['.git', 'node_modules', '.pnpm-store']);
const unavailable = (reason: string): DocumentLink => ({ status: 'unavailable', reason });

/**
 * Walks from the selected root, refusing symbolic links at every component, so a link can never read outside
 * the selected folder through a symlink. Returns the absolute path of a regular file.
 */
async function safeFile(root: string, path: string): Promise<string> {
  const parts = path.split('/');
  if (!path || parts.some((part) => part === '' || part === '.' || part === '..' || denied.has(part))) throw new DocumentError(404, 'This document is not available.');
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    let stat;
    try { stat = await lstat(current); }
    catch { throw new DocumentError(404, 'The linked document does not exist.'); }
    if (stat.isSymbolicLink()) throw new DocumentError(403, 'Links through symbolic links are not opened.');
    if (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory()) throw new DocumentError(404, index === parts.length - 1 ? 'The link does not point to a document file.' : 'The linked document does not exist.');
  }
  if (await realpath(current) !== current) throw new DocumentError(403, 'The document path changed. Reload and try again.');
  return current;
}

async function readFileSafely(absolute: string): Promise<Buffer> {
  // O_NOFOLLOW also guards a file replaced by a symlink between checking and opening.
  const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    const checked = await lstat(absolute);
    if (!opened.isFile() || checked.isSymbolicLink() || opened.dev !== checked.dev || opened.ino !== checked.ino) {
      throw new DocumentError(403, 'The document changed while it was being opened. Try again.');
    }
    if (opened.size > maxBytes) throw new DocumentError(413, 'This document is too large to display.');
    return await handle.readFile();
  } finally { await handle.close(); }
}

export function documentTitle(content: string, fallback: string): string {
  let fence: string | null = null;
  for (const line of content.replace(/^﻿/, '').split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) { fence = fence === null ? marker : marker[0] === fence[0] && marker.length >= fence.length ? null : fence; continue; }
    if (fence) continue;
    const heading = /^ {0,3}#\s+(.+?)(?:\s+#+)?\s*$/.exec(line)?.[1];
    if (heading) return heading;
  }
  return fallback;
}

async function describe(root: string, path: string, kind: SupportingDocument['kind'], feature: string | null, location: string | null): Promise<SupportingDocument | null> {
  try {
    const content = (await readFileSafely(await safeFile(root, path))).toString('utf8');
    return { path, title: documentTitle(content, basename(path).replace(/\.[^.]+$/, '')), kind, feature, location };
  } catch { return null; }
}

/**
 * Specifications and maps beside recognized issue containers, plus `docs/adr` for a repository-root launch.
 * A direct issue-folder launch exposes only documents inside that folder.
 */
export async function discoverDocuments(folder: string): Promise<DocumentList> {
  const root = await realpath(folder);
  const board = await discoverIssues(root);
  const found = new Map<string, SupportingDocument>();
  const scanned = new Set<string>();
  const scan = async (directory: string, feature: string, location: string): Promise<void> => {
    if (scanned.has(directory)) return;
    scanned.add(directory);
    let names: string[];
    try { names = (await readdir(directory === '.' ? root : join(root, directory), { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort(); }
    catch { return; }
    for (const name of names) {
      const kind = specification.test(name) ? 'specification' : map.test(name) ? 'map' : null;
      if (!kind) continue;
      const path = directory === '.' ? name : `${directory}/${name}`;
      const document = await describe(root, path, kind, feature, location);
      if (document) found.set(path, document);
    }
  };
  for (const issue of board.issues) {
    // A container selected directly is '.', so its own folder is the boundary and no parent is read.
    const featureDirectory = containers.has(basename(issue.container)) ? posix.dirname(issue.container) : issue.container;
    await scan(featureDirectory, issue.feature, issue.location);
  }
  if ((await classifyRoot(root)).repository) {
    let names: string[] = [];
    try { names = (await readdir(join(root, 'docs', 'adr'), { withFileTypes: true })).filter((entry) => entry.isFile() && markdown.test(entry.name)).map((entry) => entry.name).sort(); }
    catch { /* No ADR folder. */ }
    for (const name of names) {
      const path = `docs/adr/${name}`;
      const document = await describe(root, path, 'adr', null, null);
      if (document) found.set(path, document);
    }
  }
  const order = { specification: 0, map: 1, adr: 2 };
  return { documents: [...found.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.path.localeCompare(b.path)) };
}

export async function readDocument(folder: string, path: string): Promise<OpenedDocument> {
  const validated = issueWriteSchema.shape.path.safeParse(path);
  if (!validated.success) throw new DocumentError(400, 'Use a path relative to the selected folder.');
  if (!markdown.test(path)) throw new DocumentError(415, 'Only Markdown documents can be opened.');
  const root = await realpath(folder);
  const bytes = await readFileSafely(await safeFile(root, path));
  const content = bytes.toString('utf8');
  const known = (await discoverDocuments(root)).documents.find((document) => document.path === path);
  return {
    path, title: known?.title ?? documentTitle(content, basename(path).replace(/\.[^.]+$/, '')),
    kind: known?.kind ?? 'document', content,
  };
}

/** Resolves a relative link from its source document to an available Markdown document inside the selected folder. */
export async function resolveDocumentLink(folder: string, from: string, href: string): Promise<DocumentLink> {
  const source = issueWriteSchema.shape.path.safeParse(from);
  if (!source.success) throw new DocumentError(400, 'Use the source document path relative to the selected folder.');
  const root = await realpath(folder);
  const hash = href.indexOf('#');
  const target = (hash < 0 ? href : href.slice(0, hash)).split('?')[0] ?? '';
  // The fragment stays percent-encoded; the renderer decodes it once when matching headings.
  const fragment = hash < 0 || hash === href.length - 1 ? null : href.slice(hash + 1);
  let decoded: string;
  try { decoded = decodeURIComponent(target); }
  catch { return unavailable('The link is malformed and cannot be resolved.'); }
  if (!decoded) return unavailable('The link has no document target.');
  if (/[\x00-\x1f\\]/.test(decoded) || /^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith('//')) return unavailable('Only relative links to Markdown documents can be opened.');
  if (decoded.startsWith('/')) return unavailable('Absolute links are not resolved. Use a path relative to the linking document.');
  const resolved = posix.normalize(posix.join(posix.dirname(from), decoded));
  if (resolved === '..' || resolved.startsWith('../') || posix.isAbsolute(resolved)) {
    return unavailable('The link points outside the selected folder, so it was not read.');
  }
  if (decoded.endsWith('/') || !markdown.test(resolved)) return unavailable('Only Markdown documents inside the selected folder can be opened.');
  try { await safeFile(root, resolved); }
  catch (error) { return unavailable(error instanceof DocumentError ? error.message : 'The linked document cannot be read.'); }
  const board = await discoverIssues(root);
  return { status: 'available', path: resolved, fragment, issue: board.issues.some((issue) => issue.path === resolved) };
}

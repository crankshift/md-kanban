import { createHash } from 'node:crypto';
import { documentStatus } from './status.js';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { basename, join, posix } from 'node:path';
import { issueWriteSchema } from './board.js';
import { documentMetadata, markdownLinks } from './markdown-metadata.js';
import { type DocumentRelation, type DocumentLink, type DocumentList, type OpenedDocument, type SupportingDocument } from './document-types.js';
import { discoverIssues } from './discovery.js';

export class DocumentError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

const maxBytes = 2 * 1024 * 1024;
const markdown = /\.(?:md|markdown)$/i;
const specification = /^(?:spec|specification)\.md$/i;
const map = /^map\.md$/i;
// Visibility is query-local. Only .git is permanently protected.
export const documentExcluded = new Set(['.git']);
export const defaultHidden = new Set(['node_modules', 'vendor', '.pnpm-store', 'dist', 'build', 'coverage', '.cache', '.next']);
export type Visibility = { hide?: string[]; show?: string[] };
export const within = (path: string, folder: string): boolean => !folder || path === folder || path.startsWith(folder + '/');
const denied = documentExcluded;
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
    if (opened.size > maxBytes) throw new DocumentError(413, 'This document exceeds the 2 MiB preview limit.');
    // Bound the read as well as the stat: a concurrently growing file cannot bypass the cap.
    const buffer = Buffer.allocUnsafe(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maxBytes) throw new DocumentError(413, 'This document exceeds the 2 MiB preview limit.');
    if (await realpath(absolute) !== absolute) throw new DocumentError(403, 'The document path changed. Reload and try again.');
    return buffer.subarray(0, length);
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

function kindOf(path: string): SupportingDocument['kind'] {
  return posix.dirname(path).split('/').includes('adr') ? 'adr' : specification.test(basename(path)) ? 'specification' : map.test(basename(path)) ? 'map' : 'document';
}

async function describe(root: string, path: string): Promise<SupportingDocument> {
  let content: string | null = null;
  const problems: string[] = [];
  try { content = (await readFileSafely(await safeFile(root, path))).toString('utf8'); }
  catch (error) { problems.push(error instanceof DocumentError ? error.message : 'Cannot read this Markdown file. Check access and reload.'); }
  const metadata = documentMetadata(content ?? '');
  return { path, name: basename(path), folder: posix.dirname(path), kind: kindOf(path),
    title: documentTitle(metadata.body, basename(path).replace(/\.[^.]+$/, '')),
    feature: null, location: null, content, revision: content === null ? null : createHash('sha256').update(content).digest('hex'), status: documentStatus(content), properties: metadata.properties, diagnostics: [...problems, ...metadata.diagnostics] };
}

/** Every Markdown descendant belongs, independent of the optional issue write adapter. */
export async function discoverDocuments(folder: string, visibility: Visibility = {}): Promise<DocumentList> {
  const root = await realpath(folder);
  const documents: SupportingDocument[] = [];
  const warnings: string[] = [];
  const folders: string[] = [], hidden: string[] = [];
  async function walk(directory: string) {
    let entries;
    try {
      // Check ancestors again on recursion, including a directory atomically replaced by a symlink.
      let current = root;
      for (const part of directory.split('/').filter(Boolean)) {
        current = join(current, part);
        if ((await lstat(current)).isSymbolicLink()) throw new Error('Symbolic directory');
      }
      if (await realpath(current) !== current) throw new Error('Directory changed');
      entries = await readdir(current, { withFileTypes: true });
    } catch { warnings.push(`Cannot read directory: ${directory || '.'}. Check access and reload.`); return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (denied.has(entry.name) || entry.name.startsWith('.mdboard-')) continue;
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        folders.push(path);
        const hide = visibility.hide?.some(folder => within(path, folder)) || (defaultHidden.has(entry.name) && !visibility.show?.includes(path));
        if (hide) hidden.push(path); else await walk(path);
      }
      else if (markdown.test(entry.name)) documents.push(await describe(root, path));
    }
  }
  await walk('');
  documents.sort((a, b) => a.path.localeCompare(b.path));
  const edges = new Map<string, DocumentRelation>();
  const indexed = new Set(documents.map((document) => document.path));
  for (const document of documents) {
    const add = (href: string, kind: DocumentRelation['kind'], property?: string) => {
      const resolved = relativeDocumentTarget(document.path, href);
      if (resolved.status === 'unavailable') {
        // External links and same-file fragments do not claim a Markdown relationship.
        if (!href.startsWith('#') && !/^[a-z][a-z0-9+.-]*:/i.test(href)) document.diagnostics.push(`${kind === 'link' ? 'Link' : 'Dependency'} “${href}”: ${resolved.reason}`);
        return;
      }
      if (!indexed.has(resolved.path)) {
        document.diagnostics.push(`${kind === 'link' ? 'Link' : 'Dependency'} “${href}”: target is outside the indexed collection or unavailable. It can be followed in the reader if allowed.`);
        return;
      }
      if (resolved.path === document.path) return;
      const edge = { source: document.path, target: resolved.path, kind, ...(property ? { property } : {}) };
      edges.set(JSON.stringify([kind, property, document.path, resolved.path]), edge);
    };
    const metadata = documentMetadata(document.content ?? '');
    for (const href of markdownLinks(metadata.body)) add(href, 'link');
    for (const property of document.properties.filter((property) => property.valid)) {
      for (const value of property.values) {
        const links = markdownLinks(value);
        // Numeric/prose values remain metadata. Only explicit Markdown file targets form edges.
        const paths = value.split(/[,\n]/).map((part) => part.trim()).filter((part) => /\.(md|markdown)(?:[?#].*)?$/i.test(part));
        for (const href of [...links, ...paths]) add(href, 'dependency', property.key);
      }
    }
  }
  return { folder: root, documents, edges: [...edges.values()], warnings, folders, hidden };
}

export async function readDocument(folder: string, path: string): Promise<OpenedDocument> {
  const validated = issueWriteSchema.shape.path.safeParse(path);
  if (!validated.success) throw new DocumentError(400, 'Use a path relative to the selected folder.');
  if (!markdown.test(path)) throw new DocumentError(415, 'Only Markdown documents can be opened.');
  const root = await realpath(folder);
  const bytes = await readFileSafely(await safeFile(root, path));
  const content = bytes.toString('utf8');
  const metadata = documentMetadata(content);
  return { path, title: documentTitle(metadata.body, basename(path).replace(/\.[^.]+$/, '')), kind: kindOf(path), content, body: metadata.body,
    properties: metadata.properties, diagnostics: metadata.diagnostics, revision: createHash('sha256').update(bytes).digest('hex'), status: documentStatus(content) };
}

/** Pure path resolution shared by indexing and reader navigation. Access is checked separately. */
export function relativeDocumentTarget(from: string, href: string): DocumentLink {
  const hash = href.indexOf('#');
  const target = (hash < 0 ? href : href.slice(0, hash)).split('?')[0] ?? '';
  const fragment = hash < 0 || hash === href.length - 1 ? null : href.slice(hash + 1);
  let decoded: string;
  try { decoded = decodeURIComponent(target); }
  catch { return unavailable('The link is malformed and cannot be resolved.'); }
  if (!decoded) return unavailable('The link has no document target.');
  if (/[\x00-\x1f\\]/.test(decoded) || /^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith('//')) return unavailable('Only relative links to Markdown documents can be opened.');
  if (decoded.startsWith('/')) return unavailable('Absolute links are not resolved. Use a path relative to the linking document.');
  const resolved = posix.normalize(posix.join(posix.dirname(from), decoded));
  if (resolved === '..' || resolved.startsWith('../') || posix.isAbsolute(resolved)) return unavailable('The link points outside the selected folder, so it was not read.');
  if (decoded.endsWith('/') || !markdown.test(resolved)) return unavailable('Only Markdown documents inside the selected folder can be opened.');
  return { status: 'available', path: resolved, fragment, issue: false };
}

/** Resolves a relative link from its source document to an available Markdown document inside the selected folder. */
export async function resolveDocumentLink(folder: string, from: string, href: string): Promise<DocumentLink> {
  const source = issueWriteSchema.shape.path.safeParse(from);
  if (!source.success) throw new DocumentError(400, 'Use the source document path relative to the selected folder.');
  const root = await realpath(folder);
  const target = relativeDocumentTarget(from, href);
  if (target.status === 'unavailable') return target;
  const { path: resolved, fragment } = target;
  try { await safeFile(root, resolved); }
  catch (error) { return unavailable(error instanceof DocumentError ? error.message : 'The linked document cannot be read.'); }
  const board = await discoverIssues(root);
  return { status: 'available', path: resolved, fragment, issue: board.issues.some((issue) => issue.path === resolved) };
}

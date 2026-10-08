import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDocument, createFolder } from './document-creation.js';
import { discoverIssues } from './discovery.js';
import { discoverDocuments, DocumentError, readDocument, resolveDocumentLink } from './documents.js';
import { statusChangeSchema, issueEditSchema, commentAppendSchema, repairSchema } from './board.js';
import { patchDocumentStatus } from './status.js';
import { patchIssueStatus } from './issues.js';
import { editIssue } from './edits.js';
import { appendIssueComment, repairMarkdown } from './document.js';
import { createBoardWatcher } from './watcher.js';
import { createIssueWriter, WriteError } from './writes.js';

const assets = fileURLToPath(new URL('../client/', import.meta.url));
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

function visibilityPaths(value: string | null): string[] {
  try { const data: unknown = JSON.parse(value ?? '[]'); return Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string' && v.length < 4096 && !/[\\\x00-\x1f:]/.test(v) && v.split('/').every(p => !!p && p !== '.' && p !== '..')).slice(0, 1000) : []; } catch { return []; }
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage, limit = 16384): Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) {
    throw new WriteError(415, 'invalid_request', 'Issue changes require application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new WriteError(413, 'invalid_request', 'Issue change request is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new WriteError(400, 'invalid_request', 'Issue change must be valid JSON.'); }
}

export type RunningServer = { server: Server; url: string; close: () => Promise<void> };

export async function startServer(folder: string): Promise<RunningServer> {
  // Fail before announcing a URL if the build is missing.
  await readFile(resolve(assets, 'index.html'));
  const writer = await createIssueWriter(folder);
  const creationRoot = await realpath(folder);
  const sessionToken = randomBytes(32).toString('hex');
  const watchers = new Set<Awaited<ReturnType<typeof createBoardWatcher>>>();
  const streams = new Set<ServerResponse>();
  let url = '';
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    try {
      const site = request.headers['sec-fetch-site'];
      if (request.headers.host !== new URL(url).host ||
        (request.headers.origin !== undefined && request.headers.origin !== url) ||
        (site !== undefined && site !== 'same-origin' && site !== 'none')) {
        json(response, 403, { error: 'Open the app using its printed local URL.', code: 'invalid_origin' });
        return;
      }
      const requested = new URL(request.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(requested.pathname);
      if (pathname.startsWith('/api/')) {
        const rootStat = await lstat(creationRoot);
        if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || await realpath(creationRoot) !== creationRoot) { json(response, 403, { error: 'The launch folder changed. Stop and relaunch against the intended folder.', code: 'root_changed' }); return; }
      }
      if (['/api/source', '/api/create', '/api/documents/create', '/api/folders'].includes(pathname) && request.method === 'POST') {
        try {
          if (request.headers['x-mdboard-session'] !== sessionToken) throw new WriteError(403, 'invalid_session', 'The local session changed. Reload before saving.');
          const value = await readJson(request, 1024 * 1024);
          if (pathname === '/api/source') {
            const parsed = repairSchema.safeParse(value);
            if (!parsed.success || !('content' in parsed.data)) throw new WriteError(400, 'invalid_request', 'Supply a relative Markdown path, expected revision and source.');
            await writer.update(parsed.data, () => 'content' in parsed.data ? parsed.data.content : '');
            json(response, 200, await readDocument(creationRoot, parsed.data.path));
          } else json(response, 201, pathname === '/api/folders' ? await createFolder(creationRoot, value) : await createDocument(creationRoot, value));
        } catch (error) {
          const failure = error instanceof WriteError ? error : new WriteError(500, 'write_failed', 'Could not save. Reload and review before retrying.');
          json(response, failure.status, { error: failure.message, code: failure.code });
        }
        return;
      }
      if (['/api/edit', '/api/comment'].includes(pathname) && request.method === 'POST') {
        try {
          if (request.headers['x-mdboard-session'] !== sessionToken) throw new WriteError(403, 'invalid_session', 'The local session changed. Reload the app before saving.');
          const value = await readJson(request, 1024 * 1024);
          if (pathname === '/api/comment') {
            const parsed = commentAppendSchema.safeParse(value);
            if (!parsed.success) throw new WriteError(400, 'invalid_request', parsed.error.issues.map((issue) => issue.message).join('; '));
            json(response, 200, await writer.update(parsed.data, (issue) => appendIssueComment(issue.content!, parsed.data.comment)));
          } else {
            const parsed = issueEditSchema.safeParse(value);
            if (!parsed.success) throw new WriteError(400, 'invalid_request', parsed.error.issues.map((issue) => issue.message).join('; '));
            const board = await discoverIssues(folder);
            json(response, 200, await writer.update(parsed.data, (issue) => editIssue(issue, parsed.data.changes, board.issues)));
          }
        } catch (error) {
          const failure = error instanceof WriteError ? error : new WriteError(500, 'write_failed', 'Cannot save issue. Reload issues and try again.');
          json(response, failure.status, { error: failure.message, code: failure.code });
        }
        return;
      }
      if (pathname === '/api/repair' && request.method === 'POST') {
        try {
          if (request.headers['x-mdboard-session'] !== sessionToken) throw new WriteError(403, 'invalid_session', 'The local session changed. Reload before saving.');
          const parsed = repairSchema.safeParse(await readJson(request, 1024 * 1024));
          if (!parsed.success) throw new WriteError(400, 'invalid_request', parsed.error.issues.map((issue) => issue.message).join('; '));
          json(response, 200, await writer.update(parsed.data, (issue) => 'content' in parsed.data ? parsed.data.content : repairMarkdown(parsed.data.changes.status === undefined ? issue.content! : patchDocumentStatus(issue.content!, parsed.data.changes.status), { changes: { type: parsed.data.changes.type } })));
        } catch (error) {
          const failure = error instanceof WriteError ? error : new WriteError(500, 'write_failed', 'Cannot repair issue. Reload and try again.');
          json(response, failure.status, { error: failure.message, code: failure.code });
        }
        return;
      }
      if (pathname === '/api/status' && request.method === 'POST') {
        try {
          if (request.headers['x-mdboard-session'] !== sessionToken) throw new WriteError(403, 'invalid_session', 'The local session changed. Reload the app before saving.');
          const parsed = statusChangeSchema.safeParse(await readJson(request));
          if (!parsed.success) throw new WriteError(400, 'invalid_request', 'Supply a root-relative issue path, expected revision, and supported status.');
          json(response, 200, await writer.update(parsed.data, (issue) => patchIssueStatus(issue, parsed.data.status)));
        } catch (error) {
          const failure = error instanceof WriteError ? error : new WriteError(500, 'write_failed', 'Cannot save status. Reload issues and try again.');
          json(response, failure.status, { error: failure.message, code: failure.code });
        }
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: ['/api/status', '/api/edit', '/api/comment', '/api/create', '/api/repair'].includes(pathname) ? 'POST' : 'GET, HEAD' }).end();
        return;
      }
      if (pathname === '/api/context') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ folder, sessionToken }));
        return;
      }
      if (pathname === '/api/events') {
        const params = requested.searchParams;
        const watcher = await createBoardWatcher(creationRoot, { visibility: { hide: visibilityPaths(params.get('hide')), show: visibilityPaths(params.get('show')) }, opened: params.get('file') ?? '' });
        watchers.add(watcher);
        const unsubscribe = watcher.subscribe(version => response.write(`event: change\ndata: ${JSON.stringify({ version })}\n\n`));
        response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' });
        if (request.method === 'HEAD') { unsubscribe(); watcher.close(); watchers.delete(watcher); response.end(); return; }
        streams.add(response);
        response.on('close', () => { streams.delete(response); unsubscribe(); watcher.close(); watchers.delete(watcher); });
        response.write(`retry: 2000\nevent: ready\ndata: ${JSON.stringify({ version: watcher.version() })}\n\n`);
        return;
      }
      if (pathname === '/api/documents' || pathname === '/api/document' || pathname === '/api/document-link') {
        // Read-only: supporting documents are never written and every read re-checks the selected folder boundary.
        try {
          const params = requested.searchParams;
          const value = pathname === '/api/documents' ? await discoverDocuments(creationRoot, { hide: visibilityPaths(params.get('hide')), show: visibilityPaths(params.get('show')) })
            : pathname === '/api/document' ? await readDocument(creationRoot, params.get('path') ?? '')
              : await resolveDocumentLink(creationRoot, params.get('from') ?? '', params.get('href') ?? '');
          response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(request.method === 'HEAD' ? undefined : JSON.stringify(value));
        } catch (error) {
          const failure = error instanceof DocumentError ? error : new DocumentError(500, 'Cannot read supporting documents. Check folder access and reload.');
          response.writeHead(failure.status, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: failure.message }));
        }
        return;
      }
      if (pathname === '/api/issues') {
        try {
          const board = await discoverIssues(folder);
          response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(request.method === 'HEAD' ? undefined : JSON.stringify(board));
        } catch {
          response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Cannot discover issues in the selected folder. Check access and reload.' }));
        }
        return;
      }
      const path = resolve(assets, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(resolve(assets) + sep)) {
        response.writeHead(404).end('Not found');
        return;
      }
      let body: Buffer;
      let contentType = mime[extname(path)] ?? 'application/octet-stream';
      try { body = await readFile(path); }
      catch {
        if (pathname === '/api' || pathname.startsWith('/api/') || pathname.startsWith('/assets/') || !!extname(pathname)) { response.writeHead(404).end('Not found'); return; }
        body = await readFile(resolve(assets, 'index.html')); contentType = 'text/html; charset=utf-8';
      }
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  // Release the watcher however the server is stopped, including a plain server.close().
  const release = (): void => { for (const watcher of watchers) watcher.close(); watchers.clear(); };
  server.on('close', release);
  try {
    await new Promise<void>((resolveListening, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolveListening();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server did not receive a TCP port');
    url = `http://127.0.0.1:${address.port}`;
  } catch (error) { release(); throw error; }
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => closing ??= new Promise<void>((resolveClosed, reject) => {
    release();
    for (const stream of streams) stream.end();
    streams.clear();
    server.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
      else resolveClosed();
    });
    server.closeAllConnections();
  });
  return { server, url, close };
}

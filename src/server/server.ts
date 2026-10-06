import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverIssues } from './discovery.js';
import { statusChangeSchema } from './board.js';
import { patchIssueStatus } from './issues.js';
import { createIssueWriter, WriteError } from './writes.js';

const assets = fileURLToPath(new URL('../client/', import.meta.url));
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) {
    throw new WriteError(415, 'invalid_request', 'Status changes require application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw new WriteError(413, 'invalid_request', 'Status change request is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new WriteError(400, 'invalid_request', 'Status change must be valid JSON.'); }
}

export async function startServer(folder: string): Promise<{ server: Server; url: string }> {
  // Fail before announcing a URL if the build is missing.
  await readFile(resolve(assets, 'index.html'));
  const writer = await createIssueWriter(folder);
  const sessionToken = randomBytes(32).toString('hex');
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
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      if (pathname === '/api/status' && request.method === 'POST') {
        try {
          if (request.headers['x-md-kanban-session'] !== sessionToken) throw new WriteError(403, 'invalid_session', 'The local session changed. Reload the app before saving.');
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
        response.writeHead(405, { Allow: pathname === '/api/status' ? 'POST' : 'GET, HEAD' }).end();
        return;
      }
      if (pathname === '/api/context') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ folder, sessionToken }));
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
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
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
  return { server, url };
}

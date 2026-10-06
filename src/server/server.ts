import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverIssues } from './discovery.js';

const assets = fileURLToPath(new URL('../client/', import.meta.url));
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

export async function startServer(folder: string): Promise<{ server: Server; url: string }> {
  // Fail before announcing a URL if the build is missing.
  await readFile(resolve(assets, 'index.html'));
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      if (pathname === '/api/context') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ folder }));
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
  return { server, url: `http://127.0.0.1:${address.port}` };
}

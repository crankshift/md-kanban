import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, utimes, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../dist/server/server.js';
import { fixture } from './fixtures.mjs';

const files = {
  '.scratch/alpha/issues/01-start.md': '# 01: Start\n\nStatus: ready-for-agent\nBlocked by: None\n\nSee [the spec](../spec.md#scope) and [ADR](../../../docs/adr/0001-proposed.md).\n',
  '.scratch/alpha/issues/02-next.md': '# 02: Next\n\nStatus: needs-info\n',
  '.scratch/alpha/spec.md': '# Alpha specification\n\nStatus: ready-for-agent\n\n## Scope\nText.\n',
  '.scratch/alpha/implementation-workflow.md': '# Workflow\n',
  '.scratch/beta/issues/01-question.md': '# 01: Question\n\nStatus: open\nType: research\n',
  '.scratch/beta/map.md': '# Beta map\n\nStatus: open\n',
  'docs/adr/0001-proposed.md': '# 0001: Proposed decision\n\nStatus: proposed\n\n```md\n# Not a title\n```\n',
  'docs/adr/0002-accepted.md': 'No heading here.\n',
  'docs/adr/notes.txt': 'not markdown',
  'docs/guide.md': '# Guide\n',
};

async function serve(t, tree = files, folder) {
  const root = await fixture(t, tree);
  const started = await startServer(folder ? join(root, folder) : root);
  t.after(() => started.close());
  const get = async (path, params) => {
    const response = await fetch(`${started.url}${path}?${new URLSearchParams(params)}`);
    return { status: response.status, body: await response.json() };
  };
  return { root, url: started.url, get };
}

async function snapshot(root, directory = '') {
  const result = {};
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(result, await snapshot(root, path));
    else if (entry.isFile()) result[path] = [await readFile(join(root, path), 'utf8'), (await stat(join(root, path))).mtimeMs];
  }
  return result;
}

test('repository-root collection lists all Markdown while optional issue capabilities remain independently classified', async (t) => {
  const app = await serve(t);
  const { body } = await app.get('/api/documents');
  assert.deepEqual(body.documents.map((document) => [document.kind, document.path, document.title]), [
    ['document', '.scratch/alpha/implementation-workflow.md', 'Workflow'],
    ['document', '.scratch/alpha/issues/01-start.md', '01: Start'],
    ['document', '.scratch/alpha/issues/02-next.md', '02: Next'],
    ['specification', '.scratch/alpha/spec.md', 'Alpha specification'],
    ['document', '.scratch/beta/issues/01-question.md', '01: Question'],
    ['map', '.scratch/beta/map.md', 'Beta map'],
    ['adr', 'docs/adr/0001-proposed.md', '0001: Proposed decision'],
    ['adr', 'docs/adr/0002-accepted.md', '0002-accepted'],
    ['document', 'docs/guide.md', 'Guide'],
  ]);
  assert.ok(body.documents.every((document) => document.feature === null), 'folder paths organize generic documents');
  const board = await (await fetch(`${app.url}/api/issues`)).json();
  assert.deepEqual(board.issues.map((issue) => issue.path).sort(), ['.scratch/alpha/issues/01-start.md', '.scratch/alpha/issues/02-next.md', '.scratch/beta/issues/01-question.md']);
  assert.equal(board.issues.filter((issue) => issue.diagnostics.length).length, 0, 'a proposed ADR is not a Needs attention entry');
});

test('documents render their Markdown from disk and stay current after external edits without any write', async (t) => {
  const app = await serve(t);
  const before = await snapshot(app.root);
  const first = await app.get('/api/document', { path: 'docs/adr/0001-proposed.md' });
  assert.equal(first.status, 200);
  assert.equal(first.body.kind, 'adr');
  assert.equal(first.body.content, files['docs/adr/0001-proposed.md']);
  assert.deepEqual(await snapshot(app.root), before, 'reading writes nothing');
  await writeFile(join(app.root, 'docs/adr/0001-proposed.md'), '# 0001: Accepted decision\n\nStatus: accepted\n');
  const second = await app.get('/api/document', { path: 'docs/adr/0001-proposed.md' });
  assert.equal(second.body.title, '0001: Accepted decision');
  assert.notEqual(second.body.content, first.body.content);
  assert.equal((await app.get('/api/documents')).body.documents.find((document) => document.path === 'docs/adr/0001-proposed.md').title, '0001: Accepted decision');
});

test('relative links resolve from the source document, with fragments and issue targets', async (t) => {
  const app = await serve(t);
  const link = (from, href) => app.get('/api/document-link', { from, href }).then((result) => result.body);
  assert.deepEqual(await link('.scratch/alpha/issues/01-start.md', '../spec.md#scope'), { status: 'available', path: '.scratch/alpha/spec.md', fragment: 'scope', issue: false });
  assert.deepEqual(await link('.scratch/alpha/issues/01-start.md', '../../../docs/adr/0001-proposed.md'), { status: 'available', path: 'docs/adr/0001-proposed.md', fragment: null, issue: false });
  assert.deepEqual(await link('.scratch/alpha/spec.md', 'issues/02-next.md'), { status: 'available', path: '.scratch/alpha/issues/02-next.md', fragment: null, issue: true });
  assert.deepEqual(await link('.scratch/alpha/spec.md', './implementation-workflow.md?plain=1#top'), { status: 'available', path: '.scratch/alpha/implementation-workflow.md', fragment: 'top', issue: false });
  assert.equal((await link('.scratch/alpha/issues/01-start.md', '../spec.md#a%20b')).fragment, 'a%20b', 'fragments stay encoded for one client decode');
  assert.deepEqual(await link('.scratch/alpha/spec.md', '%2E%2E/beta/map.md'), { status: 'available', path: '.scratch/beta/map.md', fragment: null, issue: false });
});

test('missing, non-Markdown, malformed and out-of-scope links are unavailable and never read', async (t) => {
  const app = await serve(t);
  const link = (from, href) => app.get('/api/document-link', { from, href }).then((result) => result.body);
  const from = '.scratch/alpha/spec.md';
  for (const [href, reason] of [
    ['missing.md', /does not exist/],
    ['../../../outside.md', /outside the selected folder/],
    ['../../../../etc/hosts.md', /outside the selected folder/],
    ['..%2F..%2F..%2Foutside.md', /outside the selected folder/],
    ['/etc/hosts.md', /Absolute links/],
    ['C:\\temp\\x.md', /relative links/],
    ['https://example.com/x.md', /relative links/],
    ['//example.com/x.md', /relative links/],
    ['..\\spec.md', /relative links/],
    ['%00.md', /relative links/],
    ['%E0%A4%A.md', /malformed/],
    ['../../docs/', /Markdown/],
    ['../../docs/adr/notes.txt', /Markdown/],
    ['issues', /Markdown/],
    ['../../.git/config.md', /not available/],
    ['', /no document target/],
  ]) {
    const result = await link(from, href);
    assert.equal(result.status, 'unavailable', href);
    assert.match(result.reason, reason, href);
  }
  assert.equal((await app.get('/api/document', { path: '../outside.md' })).status, 400);
  assert.equal((await app.get('/api/document', { path: 'docs/adr/notes.txt' })).status, 415);
  assert.equal((await app.get('/api/document', { path: 'docs/missing.md' })).status, 404);
  assert.equal((await app.get('/api/document', { path: '.scratch/alpha/issues' })).status, 415);
  assert.equal((await app.get('/api/document-link', { from: '../x.md', href: 'a.md' })).status, 400);
});

test('symbolic links are never followed, including links that escape the selected root', async (t) => {
  const outside = await mkdtemp(join(tmpdir(), 'mdboard-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'secret.md'), '# Private\nDo not read.\n');
  const app = await serve(t);
  await symlink(join(outside, 'secret.md'), join(app.root, 'docs/leak.md'));
  await symlink(outside, join(app.root, 'docs/outside'));
  await symlink(join(app.root, 'docs/guide.md'), join(app.root, 'docs/alias.md'));
  await symlink(join(outside, 'secret.md'), join(app.root, '.scratch/alpha/spec-link.md'));
  for (const href of ['../../docs/leak.md', '../../docs/outside/secret.md', '../../docs/alias.md']) {
    const result = (await app.get('/api/document-link', { from: '.scratch/alpha/spec.md', href })).body;
    assert.equal(result.status, 'unavailable', href);
    assert.match(result.reason, /symbolic links/);
  }
  for (const path of ['docs/leak.md', 'docs/outside/secret.md', 'docs/alias.md']) {
    const response = await app.get('/api/document', { path });
    assert.equal(response.status, 403, path);
    assert.doesNotMatch(JSON.stringify(response.body), /Private|Do not read/);
  }
  const listed = (await app.get('/api/documents')).body.documents;
  assert.equal(listed.find((doc) => doc.path === 'docs/leak.md').content, null);
  assert.equal(listed.find((doc) => doc.path === '.scratch/alpha/spec-link.md').content, null);
  assert.ok(!listed.some((doc) => doc.path === 'docs/outside/secret.md'));
});

test('a root selected through a symlink stays the boundary', async (t) => {
  const app = await serve(t);
  const alias = join(app.root, '..', `mdboard-alias-${process.pid}`);
  await symlink(app.root, alias);
  t.after(() => rm(alias, { force: true }));
  const started = await startServer(alias);
  t.after(() => started.close());
  const response = await fetch(`${started.url}/api/document-link?${new URLSearchParams({ from: '.scratch/alpha/spec.md', href: '../../../x.md' })}`);
  assert.equal((await response.json()).status, 'unavailable');
  assert.equal((await fetch(`${started.url}/api/document?path=docs/guide.md`)).status, 200);
});

test('a direct issue-folder launch exposes only documents within that folder', async (t) => {
  const direct = await serve(t, { ...files, '.scratch/alpha/issues/spec.md': '# Folder spec\n\nStatus: proposed\n' }, '.scratch/alpha/issues');
  const documents = (await direct.get('/api/documents')).body.documents;
  assert.deepEqual(documents.map((document) => document.path), ['01-start.md', '02-next.md', 'spec.md']);
  assert.equal((await direct.get('/api/documents')).body.documents.some((document) => document.kind === 'adr'), false);
  assert.equal((await direct.get('/api/document-link', { from: '01-start.md', href: '../spec.md' })).body.status, 'unavailable');
  assert.equal((await direct.get('/api/document-link', { from: '01-start.md', href: '../../../docs/adr/0001-proposed.md' })).body.status, 'unavailable');
  assert.equal((await direct.get('/api/document-link', { from: '01-start.md', href: 'spec.md' })).body.status, 'available');
  assert.equal((await direct.get('/api/document', { path: 'spec.md' })).status, 200);
  assert.equal((await direct.get('/api/document', { path: '../spec.md' })).status, 400);
  const board = await (await fetch(`${direct.url}/api/issues`)).json();
  assert.deepEqual(board.issues.map((issue) => issue.path), ['01-start.md', '02-next.md']);
});

test('a feature folder launch exposes its own specification and map but not ADRs', async (t) => {
  const feature = await serve(t, files, '.scratch/alpha');
  assert.deepEqual((await feature.get('/api/documents')).body.documents.map((document) => document.path), ['implementation-workflow.md', 'issues/01-start.md', 'issues/02-next.md', 'spec.md']);
});

test('document routes are read-only GET endpoints behind the local origin checks', async (t) => {
  const app = await serve(t);
  for (const route of ['/api/documents', '/api/document', '/api/document-link']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal((await fetch(`${app.url}${route}`, { method, body: '{}' })).status, 405, `${method} ${route}`);
    }
    assert.equal((await fetch(`${app.url}${route}`, { headers: { Origin: 'https://example.com' } })).status, 403);
    assert.equal((await fetch(`${app.url}${route}`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  }
  const head = await fetch(`${app.url}/api/documents`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('cache-control'), 'no-store');
});

test('oversized documents are refused instead of being read into memory', async (t) => {
  const app = await serve(t, { ...files, 'docs/huge.md': `# Huge\n${'x'.repeat(2 * 1024 * 1024 + 1)}` });
  assert.equal((await app.get('/api/document', { path: 'docs/huge.md' })).status, 413);
});

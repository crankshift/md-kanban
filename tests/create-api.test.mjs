import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, symlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './fixtures.mjs';
import { startServer } from '../dist/server/server.js';
async function app(t, files = {}) {
  const folder = await fixture(t, files), server = await startServer(folder); t.after(server.close);
  const { sessionToken } = await (await fetch(server.url + '/api/context')).json();
  const headers = { 'Content-Type': 'application/json', 'X-Mdboard-Session': sessionToken, Origin: server.url };
  const post = (endpoint, data, extra = {}) => fetch(server.url + endpoint, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(data) });
  return { folder, post, url: server.url };
}
const draft = { folder: '', filename: 'note.md', title: 'An authored issue', status: 'Awaiting moonrise', body: 'Optional body.' };
test('creates minimal Markdown with authored or absent status in arbitrary and empty folders', async t => {
  const a = await app(t);
  const folder = await a.post('/api/folders', { parent: '', name: 'empty' }); assert.equal(folder.status, 201);
  assert.deepEqual(await readdir(join(a.folder, 'empty')), []);
  // Directory creation stands alone, including cancellation of the issue form.
  const created = await a.post('/api/create', { ...draft, folder: 'empty' }); assert.equal(created.status, 201);
  const doc = await created.json(); assert.equal(doc.path, 'empty/note.md');
  assert.equal(await readFile(join(a.folder, doc.path), 'utf8'), '# An authored issue\n\nStatus: Awaiting moonrise\n\nOptional body.\n');
  assert.equal((await a.post('/api/create', { ...draft, status: '', body: '' })).status, 201);
  assert.equal(await readFile(join(a.folder, 'note.md'), 'utf8'), '# An authored issue\n\n');
});
test('exclusive publication never overwrites occupied filenames or duplicates a lost-response retry', async t => {
  const a = await app(t, { 'note.md': 'External content' });
  assert.equal((await a.post('/api/create', draft)).status, 409);
  assert.equal(await readFile(join(a.folder, 'note.md'), 'utf8'), 'External content');
  const concurrent = await Promise.all([a.post('/api/create', { ...draft, filename: 'new.md' }), a.post('/api/create', { ...draft, filename: 'new.md' })]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
  assert.equal((await a.post('/api/create', { ...draft, filename: 'new.md' })).status, 409);
  assert.ok(!(await readdir(a.folder)).some(name => name.startsWith('.mdboard-')));
});
test('document/folder creation share session, origin, relative path and symlink protections', async t => {
  const a = await app(t, { 'real/old.md': '# Old' }), outside = await fixture(t, { 'keep.md': '# Outside' });
  await symlink(outside, join(a.folder, 'alias'), 'dir');
  for (const folder of ['../outside', '/tmp', '.git', 'alias', 'real/../real', 'real\\child']) {
    assert.notEqual((await a.post('/api/create', { ...draft, folder })).status, 201);
    assert.notEqual((await a.post('/api/folders', { parent: folder, name: 'new' })).status, 201);
  }
  for (const filename of ['../escape.md', 'sub/note.md', '.git', 'plain.txt', 'bad\0.md']) assert.equal((await a.post('/api/create', { ...draft, filename })).status, 400);
  for (const name of ['..', 'a/b', '.git', 'bad\0', '.mdboard-private']) assert.equal((await a.post('/api/folders', { parent: '', name })).status, 400);
  for (const endpoint of ['/api/create', '/api/folders']) {
    const data = endpoint === '/api/create' ? draft : { parent: '', name: 'safe' };
    assert.equal((await a.post(endpoint, data, { 'X-Mdboard-Session': 'wrong' })).status, 403);
    assert.equal((await a.post(endpoint, data, { Origin: 'http://other.invalid' })).status, 403);
  }
  assert.deepEqual(await readdir(outside), ['keep.md']);
});
test('creation pins the launch root and rejects its replacement by a symlink', async t => {
  const a = await app(t), outside = await fixture(t, { 'outside.md': '# Outside' });
  await rename(a.folder, a.folder + '-old'); t.after(async () => { await import('node:fs/promises').then(fs => fs.rm(a.folder + '-old', { recursive: true, force: true })); });
  await symlink(outside, a.folder, 'dir');
  assert.notEqual((await a.post('/api/create', draft)).status, 201);
  assert.notEqual((await a.post('/api/folders', { parent: '', name: 'escaped' })).status, 201);
  assert.deepEqual(await readdir(outside), ['outside.md']);
});
test('abandoned creation locks require explicit recovery and leave drafts/files intact', async t => {
  const a = await app(t); await writeFile(join(a.folder, '.mdboard-create.lock'), '');
  assert.equal((await a.post('/api/create', draft)).status, 409);
  assert.equal((await a.post('/api/folders', { parent: '', name: 'new' })).status, 409);
  assert.deepEqual(await readdir(a.folder), ['.mdboard-create.lock']);
});

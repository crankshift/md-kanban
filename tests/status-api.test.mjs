import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, chmod, stat, readdir, writeFile, symlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startServer } from '../dist/server/server.js';
import { fixture } from './fixtures.mjs';
import { launch } from './helpers.mjs';

async function appFor(t, files) {
  const folder = await fixture(t, files);
  const { server, url } = await startServer(folder);
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const context = await (await fetch(`${url}/api/context`)).json();
  const board = await (await fetch(`${url}/api/issues`)).json();
  const headers = { 'Content-Type': 'application/json', 'X-Mdkanban-Session': context.sessionToken, Origin: url };
  const move = (issue, status, options = {}) => fetch(`${url}/api/status`, {
    method: 'POST', headers, body: JSON.stringify({ path: issue.path, expectedRevision: issue.revision, status }), ...options,
  });
  return { folder, url, board, headers, move };
}

async function withHost(url, method, body, headers) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers: { ...headers, Host: 'example.org' } }, (response) => {
      let text = '';
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('status saves preserve all surrounding bytes and refresh the issue revision for both workflows', async (t) => {
  const files = {
    '01-plain.md': '\uFEFF# 01: Plain\r\n\r\n  Status: \tready-for-agent  \r\nBlocked by: 99 — Advisory\r\n\r\n## Unknown\r\n- [x] Keep café 🌥\r\nStatus: needs-info\r\n\r\n## Comments\r\nUnchanged.  ',
    '02-bold.md': '# 02: Bold\n\n**Status:** open\n**Type:** research\n\n## Notes\nKeep **formatting**.\n',
    '03-colon.md': '# 03: Colon\n\n**Status**: claimed\nType: task\n\n## Comments\nKeep me.\n',
  };
  const app = await appFor(t, files);
  await chmod(join(app.folder, '01-plain.md'), 0o640);
  for (const [index, status] of ['needs-info', 'resolved', 'open'].entries()) {
    const issue = app.board.issues[index];
    const response = await app.move(issue, status);
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.status, status);
    assert.notEqual(saved.revision, issue.revision);
    const expected = files[issue.path].replace(issue.status, status);
    assert.deepEqual(await readFile(join(app.folder, issue.path)), Buffer.from(expected));
    assert.equal(saved.content, expected);
    const loaded = await (await fetch(`${app.url}/api/issues`)).json();
    assert.equal(loaded.issues.find((candidate) => candidate.id === issue.id).revision, saved.revision);
  }
  assert.equal((await stat(join(app.folder, '01-plain.md'))).mode & 0o777, 0o640);
  assert.deepEqual((await readdir(app.folder)).sort(), Object.keys(files).sort(), 'no temporary files remain');
});

test('external edits and simultaneous same-revision writes cannot silently overwrite each other', async (t) => {
  const app = await appFor(t, { '01-change.md': '# 01: Change\nStatus: open\n\n## Comments\nOriginal.\n' });
  const issue = app.board.issues[0];
  const external = '# 01: Change\nStatus: claimed\n\n## Comments\nAgent wrote this.\n';
  await writeFile(join(app.folder, issue.path), external);
  const stale = await app.move(issue, 'resolved');
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /Reload issues/);
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), external);
  const latest = (await (await fetch(`${app.url}/api/issues`)).json()).issues[0];
  const responses = await Promise.all([app.move(latest, 'open'), app.move(latest, 'resolved')]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const winner = await responses.find((response) => response.status === 200).json();
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), winner.content);
  assert.match(winner.content, /Agent wrote this/);
});

test('separate CLI processes share the write boundary and abandoned locks have explicit recovery', { timeout: 15000 }, async (t) => {
  const folder = await fixture(t, { '01-change.md': '# 01: Change\nStatus: open\n' });
  const cli = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));
  const apps = await Promise.all([launch(t, cli, folder, ['--no-open']), launch(t, cli, folder, ['--no-open'])]);
  const urls = await Promise.all(apps.map((app) => app.url));
  const contexts = await Promise.all(urls.map(async (url) => (await fetch(`${url}/api/context`)).json()));
  const issue = (await (await fetch(`${urls[0]}/api/issues`)).json()).issues[0];
  const responses = await Promise.all(urls.map((url, index) => fetch(`${url}/api/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdkanban-Session': contexts[index].sessionToken },
    body: JSON.stringify({ path: issue.path, expectedRevision: issue.revision, status: index === 0 ? 'claimed' : 'resolved' }),
  })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const winner = await responses.find((response) => response.status === 200).json();
  assert.equal(await readFile(join(folder, issue.path), 'utf8'), winner.content);
  const lockName = `.mdkanban-${createHash('sha256').update('01-change.md').digest('hex')}.lock`;
  await writeFile(join(folder, lockName), '');
  const locked = await fetch(`${urls[0]}/api/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdkanban-Session': contexts[0].sessionToken },
    body: JSON.stringify({ path: winner.path, expectedRevision: winner.revision, status: 'open' }),
  });
  assert.equal(locked.status, 409);
  assert.match((await locked.json()).error, /stop all mdkanban processes.*remove/);
  assert.equal(await readFile(join(folder, issue.path), 'utf8'), winner.content);
  for (const app of apps) { app.child.kill('SIGTERM'); assert.equal((await app.exit).code, 0); }
});

test('rejects malformed requests, workflow changes, arbitrary documents and escaped or symlinked paths', async (t) => {
  const files = {
    'issues/01-change.md': '# 01: Change\nStatus: ready-for-agent\n',
    'issues/02-attention.md': '# 02: Attention\nStatus: done\n',
    'spec.md': '# Specification\nStatus: ready-for-agent\n',
  };
  const app = await appFor(t, files);
  const issue = app.board.issues.find((candidate) => candidate.number === '01');
  const valid = { path: issue.path, expectedRevision: issue.revision, status: 'needs-info' };
  for (const body of ['{', 'null', '[]', JSON.stringify({ ...valid, extra: true }),
    JSON.stringify({ ...valid, status: 'done' }), JSON.stringify({ ...valid, expectedRevision: undefined }),
    ...['../outside.md', '/tmp/outside.md', 'issues/../../outside.md', 'issues\\01-change.md', 'issues/./01-change.md', 'issues//01-change.md'].map((path) => JSON.stringify({ ...valid, path }))]) {
    assert.equal((await app.move(issue, 'needs-info', { body })).status, 400, body);
  }
  assert.equal((await app.move(issue, 'open')).status, 422, 'cannot change workflow');
  assert.equal((await app.move(app.board.issues.find((candidate) => candidate.number === '02'), 'needs-info')).status, 422);
  assert.equal((await app.move({ ...issue, path: 'spec.md' }, 'needs-info')).status, 404);
  assert.equal((await app.move(issue, 'needs-info', { headers: { ...app.headers, 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await app.move(issue, 'needs-info', { body: JSON.stringify({ ...valid, padding: 'x'.repeat(17000) }) })).status, 413);
  for (const [path, content] of Object.entries(files)) assert.equal(await readFile(join(app.folder, path), 'utf8'), content);
  const outside = await fixture(t, { '01-external.md': '# 01: External\nStatus: ready-for-agent\n' });
  await rename(join(app.folder, 'issues'), join(app.folder, 'original'));
  await symlink(outside, join(app.folder, 'issues'), 'dir');
  assert.equal((await app.move(issue, 'needs-info')).status, 404);
  assert.equal(await readFile(join(outside, '01-external.md'), 'utf8'), '# 01: External\nStatus: ready-for-agent\n');
  assert.equal(await readFile(join(app.folder, 'original/01-change.md'), 'utf8'), files['issues/01-change.md']);
});

test('only the correct local host, origin and app session can write or retrieve a session token', async (t) => {
  const app = await appFor(t, { '01-change.md': '# 01: Change\nStatus: open\n' });
  const issue = app.board.issues[0];
  const second = await appFor(t, { '01-other.md': '# 01: Other\nStatus: open\n' });
  for (const headers of [
    { ...app.headers, 'X-Mdkanban-Session': '' },
    { ...app.headers, 'X-Mdkanban-Session': second.headers['X-Mdkanban-Session'] },
    { ...app.headers, Origin: 'https://example.org' },
    { ...app.headers, Origin: 'null' },
    { ...app.headers, 'Sec-Fetch-Site': 'cross-site' },
    { ...app.headers, 'Sec-Fetch-Site': 'same-site' },
  ]) assert.equal((await app.move(issue, 'claimed', { headers })).status, 403, JSON.stringify(headers));
  for (const headers of [{ Origin: 'https://example.org' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const response = await fetch(`${app.url}/api/context`, { headers });
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), new RegExp(app.headers['X-Mdkanban-Session']));
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal((await withHost(`${app.url}/api/status`, 'POST', JSON.stringify({ path: issue.path, expectedRevision: issue.revision, status: 'claimed' }), app.headers)).status, 403);
  const rebinding = await withHost(`${app.url}/api/context`, 'GET', undefined, {});
  assert.equal(rebinding.status, 403);
  assert.doesNotMatch(rebinding.text, new RegExp(app.headers['X-Mdkanban-Session']));
  assert.equal((await fetch(`${app.url}/api/status`, { method: 'OPTIONS', headers: { Origin: 'https://example.org' } })).status, 403);
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), issue.content);
});

test('disk failures and invalid UTF-8 leave originals intact, with a usable retry after recovery', async (t) => {
  const app = await appFor(t, { '01-change.md': '# 01: Change\nStatus: open\n' });
  const issue = app.board.issues[0];
  await chmod(join(app.folder, issue.path), 0o444);
  t.after(() => chmod(join(app.folder, issue.path), 0o644).catch(() => {}));
  const failed = await app.move(issue, 'claimed');
  assert.equal(failed.status, 500);
  assert.match((await failed.json()).error, /Check folder access/);
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), issue.content);
  await chmod(join(app.folder, issue.path), 0o644);
  assert.equal((await app.move(issue, 'claimed')).status, 200, 'failure does not poison subsequent writes');
  await writeFile(join(app.folder, issue.path), Buffer.concat([Buffer.from(issue.content), Buffer.from([0xff])]));
  const invalid = (await (await fetch(`${app.url}/api/issues`)).json()).issues[0];
  assert.equal((await app.move(invalid, 'claimed')).status, 409, 'raw bytes do not match a lossy UTF-8 revision');
  assert.equal((await readFile(join(app.folder, issue.path))).at(-1), 0xff);
  assert.deepEqual(await readdir(app.folder), ['01-change.md']);
});

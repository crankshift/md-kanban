import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './fixtures.mjs';
import { startServer } from '../dist/server/server.js';

async function appFor(t, files) {
  const folder = await fixture(t, files);
  const { server, url } = await startServer(folder);
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const { sessionToken } = await (await fetch(`${url}/api/context`)).json();
  const targets = async () => (await (await fetch(`${url}/api/creation-targets`)).json());
  const send = (target, fields = {}, headers = {}) => fetch(`${url}/api/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdkanban-Session': sessionToken, ...headers },
    body: JSON.stringify({ container: target.container, workflow: target.workflow, expectedRevision: target.revision,
      title: 'New issue', status: target.workflow === 'implementation' ? 'needs-triage' : 'open', body: '## Outcome\nPortable body.', dependencies: [], ...fields }),
  });
  return { folder, url, targets, send };
}

test('creation follows container conventions, preserves files and returns discoverable issues', async (t) => {
  const original = '# 009 — Existing\r\n\r\n**Status:** ready-for-agent\r\n**Blocked by:** None\r\n';
  const app = await appFor(t, { '.scratch/alpha/issues/009_existing.md': original });
  const [target] = await app.targets();
  const response = await app.send(target, { dependencies: ['.scratch/alpha/issues/009_existing.md'] });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.path, '.scratch/alpha/issues/010_new-issue.md');
  assert.equal(saved.content, '# 010 — New issue\r\n\r\n**Status:** needs-triage\r\n**Blocked by:** 009\r\n\r\n## Outcome\r\nPortable body.\r\n');
  assert.equal(await readFile(join(app.folder, saved.path), 'utf8'), saved.content);
  assert.equal(await readFile(join(app.folder, '.scratch/alpha/issues/009_existing.md'), 'utf8'), original);
  const board = await (await fetch(`${app.url}/api/issues`)).json();
  assert.ok(board.issues.some((issue) => issue.id === saved.id && issue.revision === saved.revision));
});

test('creation works in docs and arbitrary direct folders with recognized workflows', async (t) => {
  for (const path of ['docs/effort/tickets/01-question.md', '01-question.md']) {
    const app = await appFor(t, { [path]: '# 01: Question\nStatus: open\nType: research\n' });
    const [target] = await app.targets();
    const response = await app.send(target, { title: 'Investigate café / ../ boundaries', type: 'prototype', status: 'claimed' });
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.workflow, 'wayfinding');
    assert.equal(saved.type, 'prototype');
    assert.equal(saved.status, 'claimed');
    assert.match(saved.path, /02-investigate-cafe-boundaries.md$/);
    assert.deepEqual(saved.diagnostics, []);
  }
});

test('stale snapshots and concurrent creations never overwrite or silently both succeed', async (t) => {
  const { writeFile, readdir } = await import('node:fs/promises');
  const app = await appFor(t, { 'issues/01-existing.md': '# 01: Existing\nStatus: ready-for-agent\n' });
  const [stale] = await app.targets();
  await writeFile(join(app.folder, 'issues/01-existing.md'), '# 01: External\nStatus: needs-info\n');
  assert.equal((await app.send(stale)).status, 409);
  const [latest] = await app.targets();
  const responses = await Promise.all([app.send(latest), app.send(latest)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.deepEqual((await readdir(join(app.folder, 'issues'))).sort(), ['01-existing.md', '02-new-issue.md']);
  assert.equal(await readFile(join(app.folder, 'issues/01-existing.md'), 'utf8'), '# 01: External\nStatus: needs-info\n');
  // A separate server uses the same on-disk scope lock and snapshot protection.
  const other = await startServer(app.folder);
  t.after(() => new Promise((resolve) => { other.server.close(resolve); other.server.closeAllConnections(); }));
  const { sessionToken } = await (await fetch(`${other.url}/api/context`)).json();
  const [next] = await app.targets();
  const concurrent = await Promise.all([app.send(next), fetch(`${other.url}/api/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdkanban-Session': sessionToken },
    body: JSON.stringify({ container: next.container, workflow: next.workflow, expectedRevision: next.revision, title: 'Other', status: 'needs-info', body: '', dependencies: [] }),
  })]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  assert.equal((await readdir(join(app.folder, 'issues'))).length, 3);
});

test('occupied numbers, including symlinks and directories, are reserved across the same scope', async (t) => {
  const { mkdir, symlink, writeFile } = await import('node:fs/promises');
  const app = await appFor(t, {
    '.scratch/alpha/issues/01-existing.md': '# 01: Existing\nStatus: ready-for-agent\n',
    '.scratch/alpha/tickets/08-related.md': '# 08: Related\nStatus: ready-for-human\n',
  });
  await mkdir(join(app.folder, '.scratch/alpha/issues/09-reserved.md'));
  await symlink('01-existing.md', join(app.folder, '.scratch/alpha/issues/10-new-issue.md'));
  await writeFile(join(app.folder, '.scratch/alpha/issues/11-bad.md'), 'Malformed, reserved.');
  const target = (await app.targets()).find((target) => target.container.endsWith('/issues'));
  const response = await app.send(target);
  assert.equal(response.status, 201);
  assert.match((await response.json()).path, /12-new-issue.md$/);
  assert.equal(await readFile(join(app.folder, '.scratch/alpha/issues/10-new-issue.md'), 'utf8'), '# 01: Existing\nStatus: ready-for-agent\n');
});

test('invalid paths, metadata, dependencies and session/origin requests leave the container intact', async (t) => {
  const { readdir, symlink } = await import('node:fs/promises');
  const app = await appFor(t, {
    '.scratch/alpha/issues/01-existing.md': '# 01: Existing\nStatus: ready-for-agent\n',
    '.scratch/beta/issues/01-other.md': '# 01: Other\nStatus: open\n',
    'docs/adr/0001-proposed.md': '# ADR\nStatus: proposed\n',
  });
  await symlink('alpha/issues', join(app.folder, '.scratch/linked'));
  const target = (await app.targets()).find((target) => target.feature === 'alpha');
  for (const fields of [
    { container: '../outside' }, { container: '/tmp' }, { container: '.scratch/linked' }, { container: 'docs/adr' },
    { container: '.scratch/new/issues' }, { expectedRevision: 'bad' }, { title: '' }, { title: 'two\nlines' },
    { title: 'Title ##' }, { status: 'open' }, { type: 'research' }, { extra: 'no' },
    { body: 'Status: open' }, { body: '## Comments\nNot a body' }, { body: '```\nUnclosed' },
    { dependencies: ['.scratch/beta/issues/01-other.md'] },
  ]) {
    const response = await app.send(target, fields);
    assert.ok(response.status >= 400, JSON.stringify(fields));
  }
  assert.equal((await app.send(target, {}, { 'X-Mdkanban-Session': '' })).status, 403);
  assert.equal((await app.send(target, {}, { Origin: 'https://example.org' })).status, 403);
  assert.equal((await app.send(target, {}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.deepEqual(await readdir(join(app.folder, '.scratch/alpha/issues')), ['01-existing.md']);
});

test('disk failures and abandoned locks leave no new issue and allow an explicit retry', async (t) => {
  const { chmod, writeFile, unlink, readdir } = await import('node:fs/promises');
  const app = await appFor(t, { 'issues/1-existing.md': '# 1. Existing\nStatus: ready-for-agent\n' });
  const [target] = await app.targets();
  const directory = join(app.folder, 'issues');
  t.after(() => chmod(directory, 0o700).catch(() => {}));
  await chmod(directory, 0o500);
  assert.equal((await app.send(target)).status, 500);
  await chmod(directory, 0o700);
  assert.deepEqual(await readdir(directory), ['1-existing.md']);
  await writeFile(join(directory, '.mdkanban-create.lock'), 'Interrupted');
  assert.equal((await app.send(target)).status, 409);
  await unlink(join(directory, '.mdkanban-create.lock'));
  const response = await app.send(target);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).path, 'issues/2-new-issue.md');
  assert.deepEqual((await readdir(directory)).sort(), ['1-existing.md', '2-new-issue.md']);
});

test('overlapping root launches serialize allocation, and direct issue-folder locks stay in scope', async (t) => {
  const { readdir } = await import('node:fs/promises');
  const app = await appFor(t, { 'issues/01-existing.md': '# 01: Existing\nStatus: ready-for-agent\n' });
  const direct = await startServer(join(app.folder, 'issues'));
  t.after(() => new Promise((resolve) => { direct.server.close(resolve); direct.server.closeAllConnections(); }));
  const { sessionToken } = await (await fetch(`${direct.url}/api/context`)).json();
  const [target] = await app.targets();
  const [directTarget] = await (await fetch(`${direct.url}/api/creation-targets`)).json();
  const responses = await Promise.all([app.send(target), fetch(`${direct.url}/api/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdkanban-Session': sessionToken },
    body: JSON.stringify({ container: '.', workflow: directTarget.workflow, expectedRevision: directTarget.revision, title: 'Different title', status: 'needs-info', body: '', dependencies: [] }),
  })]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.deepEqual(await readdir(app.folder), ['issues']);
  assert.equal((await readdir(join(app.folder, 'issues'))).length, 2);
});

test('unnumbered title conventions ignore numbered headings in body examples', async (t) => {
  const app = await appFor(t, { '01-example.md': '# Existing unnumbered title\n**Status**: ready-for-agent\n\n## Notes\n```md\n# 99: Body example\n```\n' });
  const [target] = await app.targets();
  const response = await app.send(target);
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.number, '02');
  assert.match(saved.content, /^# New issue\n\n\*\*Status\*\*: needs-triage\n/);
});

test('creation pins the selected root and rejects later symlink replacement', async (t) => {
  const { rename, symlink, unlink, readdir } = await import('node:fs/promises');
  const outside = await fixture(t, { '01-other.md': '# 01: Other\nStatus: ready-for-agent\n' });
  const app = await appFor(t, { '01-existing.md': '# 01: Existing\nStatus: ready-for-agent\n' });
  const [target] = await app.targets();
  const parked = `${app.folder}-parked`;
  await rename(app.folder, parked);
  await symlink(outside, app.folder);
  try {
    const response = await app.send(target);
    assert.ok(response.status >= 400);
    assert.deepEqual(await readdir(outside), ['01-other.md']);
  } finally { await unlink(app.folder); await rename(parked, app.folder); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer } from '../dist/server/server.js';
import { fixture } from './fixtures.mjs';

async function appFor(t, files) {
  const folder = await fixture(t, files);
  const app = await startServer(folder);
  t.after(() => app.close());
  const { sessionToken } = await (await fetch(`${app.url}/api/context`)).json();
  return { folder,
    load: async () => (await (await fetch(`${app.url}/api/issues`)).json()).issues,
    send: (issue, fields, headers = {}) => fetch(`${app.url}/api/repair`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': sessionToken, ...headers },
      body: JSON.stringify({ path: issue.path, expectedRevision: issue.revision, ...fields }),
    }),
  };
}

test('explicit candidate status repair preserves all bytes outside the selected value', async (t) => {
  const original = '\uFEFF# 01: Candidate\r\n\r\n **Status**: mystery \t\r\nBlocked by: None\r\n\r\n## Notes\r\nStatus: leave this\r\n- [x] café\r\n\r\n## Comments\r\nKeep.  ';
  const app = await appFor(t, { '01-candidate.md': original });
  const [issue] = await app.load();
  const response = await app.send(issue, { changes: { status: 'open' } });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.workflow, null);
  assert.deepEqual(saved.diagnostics, []);
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), original.replace('mystery', 'open'));
});

test('missing status is inserted next to metadata or below the title, retaining style and newline bytes', async (t) => {
  for (const [original, expected] of [
    ['# 01: Candidate\n\nBody.  ', '# 01: Candidate\nStatus: ready-for-agent\n\nBody.  '],
    ['# 01: Candidate', '# 01: Candidate\nStatus: ready-for-agent\n'],
    ['\uFEFF# 01: Candidate\r\n\r\n **Blocked by:** None \t\r\n\r\n## Notes\r\nKeep.', '\uFEFF# 01: Candidate\r\n\r\n **Blocked by:** None \t\r\n**Status:** ready-for-agent\r\n\r\n## Notes\r\nKeep.'],
  ]) {
    const app = await appFor(t, { '01-candidate.md': original });
    const [issue] = await app.load();
    const response = await app.send(issue, { changes: { status: 'ready-for-agent' } });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.content, expected);
    assert.equal(saved.workflow, null);
  }
});

test('Type conflict can be fixed by removal or wayfinding status and unknown Type by replacement', async (t) => {
  const original = '# 01: Candidate\n**Status:** ready-for-agent\n **Type**: research  \n\n## Notes\nType: keep\n';
  for (const [changes, expected, workflow] of [
    [{ type: null }, original.replace(' **Type**: research  \n', ''), 'implementation'],
    [{ status: 'claimed' }, original.replace('ready-for-agent', 'claimed'), 'wayfinding'],
    [{ status: 'open', type: 'task' }, original.replace('ready-for-agent', 'open').replace('research', 'task'), 'wayfinding'],
  ]) {
    const app = await appFor(t, { '01-candidate.md': original });
    const response = await app.send((await app.load())[0], { changes });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.content, expected);
    assert.equal(saved.workflow, null);
  }
  const app = await appFor(t, { '01-candidate.md': '# 01: Candidate\nStatus: open\nType: unknown\n' });
  const response = await app.send((await app.load())[0], { changes: { type: 'prototype' } });
  assert.equal((await response.json()).workflow, null);
});

test('partial and raw repairs persist only explicit edits and return remaining diagnostics', async (t) => {
  const app = await appFor(t, { '01-candidate.md': '# 02: Candidate\nStatus: mystery\n' });
  let [issue] = await app.load();
  let response = await app.send(issue, { changes: { status: 'open' } });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.deepEqual(issue.diagnostics, ['Filename and heading issue numbers disagree.']);
  assert.equal(issue.workflow, null);
  response = await app.send(issue, { content: '# 01: Candidate\nStatus: open\nType: odd\n' });
  issue = await response.json();
  assert.deepEqual(issue.diagnostics, []);
  response = await app.send(issue, { content: '# 01: Candidate\nStatus: open\nType: task\n' });
  assert.equal((await response.json()).workflow, null);
});

test('both repair modes reject stale revisions, session/origin violations, invalid requests and supporting paths', async (t) => {
  const original = '# 01: Candidate\nStatus: mystery\n';
  const app = await appFor(t, { '01-candidate.md': original, 'spec.md': '# Specification\n' });
  const [issue] = await app.load();
  for (const fields of [{ changes: {} }, { changes: { extra: true } }, { content: 'a\0b' }, { content: 'x', changes: { status: 'open' } }]) {
    assert.equal((await app.send(issue, fields)).status, 400);
  }
  assert.equal((await app.send(issue, { changes: { status: 'open' } }, { 'X-Mdboard-Session': 'wrong' })).status, 403);
  assert.equal((await app.send(issue, { content: 'x' }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await app.send({ ...issue, path: 'spec.md' }, { content: 'x' })).status, 409, 'a generic document is writable but still needs its own revision');
  assert.equal((await app.send({ ...issue, path: '../outside.md' }, { content: 'x' })).status, 400);
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), original);
  const external = original + '\nExternal comment.\n';
  await writeFile(join(app.folder, issue.path), external);
  for (const fields of [{ changes: { status: 'open' } }, { content: original.replace('mystery', 'open') }]) {
    assert.equal((await app.send(issue, fields)).status, 409);
    assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), external);
  }
  const latest = (await app.load())[0];
  const concurrent = await Promise.all([app.send(latest, { changes: { status: 'open' } }), app.send(latest, { content: original.replace('mystery', 'resolved') })]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);
});

test('duplicate or malformed chosen metadata requires raw editing and never guesses a line', async (t) => {
  for (const original of ['# 01: Candidate\nStatus: mystery\nStatus: odd\n', '# 01: Candidate\nStatus open\n']) {
    const app = await appFor(t, { '01-candidate.md': original });
    const [issue] = await app.load();
    assert.equal((await app.send(issue, { changes: { status: 'open' } })).status, 422);
    assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), original);
    const response = await app.send(issue, { content: '# 01: Candidate\nStatus: open\n' });
    assert.equal((await response.json()).workflow, null);
  }
});

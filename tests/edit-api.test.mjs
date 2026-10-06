import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer } from '../dist/server/server.js';
import { fixture } from './fixtures.mjs';

async function appFor(t, files) {
  const folder = await fixture(t, files);
  const { server, url } = await startServer(folder);
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const { sessionToken } = await (await fetch(`${url}/api/context`)).json();
  const load = async () => (await (await fetch(`${url}/api/issues`)).json()).issues;
  const send = (endpoint, issue, fields, headers = {}) => fetch(`${url}/api/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdkanban-Session': sessionToken, ...headers },
    body: JSON.stringify({ path: issue.path, expectedRevision: issue.revision, ...fields }),
  });
  return { folder, load, send };
}

test('explicit metadata edits preserve Markdown formatting, checkboxes, body and comments', async (t) => {
  const original = '\uFEFF# 01 — Original title  ##\r\n\r\n **Status**: ready-for-agent \t\r\n**Blocked by:** None (first issue)  \r\n\r\nOwner: keep me\r\n\r\n## Acceptance\r\n- [x] Preserve café\r\nStatus: needs-info\r\n\r\n## Comments\r\nExisting comment.  ';
  const app = await appFor(t, { '01-example.md': original });
  let [issue] = await app.load();
  let response = await app.send('edit', issue, { changes: { title: 'New title' } });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.equal(issue.title, 'New title');
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), original.replace('Original title', 'New title'));
  response = await app.send('edit', issue, { changes: { status: 'needs-info' } });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), original.replace('Original title', 'New title').replace('ready-for-agent', 'needs-info'));
});

test('dependency edits are scoped to the same effort and preserve representation when unchanged', async (t) => {
  const original = '# 01: Example\nStatus: open\n**Blocked by:** 02 — Prerequisite, with a comma  \n\n## Notes\nKeep.\n';
  const app = await appFor(t, {
    '.scratch/alpha/issues/01-example.md': original,
    '.scratch/alpha/tickets/02-prerequisite.md': '# 02: Prerequisite, with a comma\nStatus: resolved\n',
    '.scratch/beta/issues/02-other.md': '# 02: Other\nStatus: open\n',
  });
  const issues = await app.load();
  let issue = issues.find((candidate) => candidate.number === '01');
  const prerequisite = issues.find((candidate) => candidate.title.startsWith('Prerequisite'));
  let response = await app.send('edit', issue, { changes: { dependencies: [prerequisite.id] } });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.equal(issue.content, original);
  response = await app.send('edit', issue, { changes: { dependencies: [issues.find((candidate) => candidate.feature === 'beta').id] } });
  assert.equal(response.status, 422);
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), original);
  response = await app.send('edit', issue, { changes: { dependencies: [] } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content, original.replace('02 — Prerequisite, with a comma', 'None'));
});

test('body editing preserves metadata and comments, and comments append within their section', async (t) => {
  const original = '# 01: Example\r\nStatus: open\r\n\r\n## Acceptance\r\n- [x] Old\r\n\r\n```md\r\n## Comments\r\nNot a section\r\n```\r\n\r\n## Comments\r\nFirst comment.  \r\n\r\n## Audit\r\nUnrelated later section.\r\n';
  const app = await appFor(t, { '01-example.md': original });
  let [issue] = await app.load();
  let response = await app.send('edit', issue, { changes: { body: '## Acceptance\n- [x] New' } });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.equal(issue.content, '# 01: Example\r\nStatus: open\r\n\r\n## Acceptance\r\n- [x] New\r\n\r\n## Comments\r\nFirst comment.  \r\n\r\n## Audit\r\nUnrelated later section.\r\n');
  response = await app.send('comment', issue, { comment: '**Second** comment.\n\n- A note' });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.content, issue.content.replace('## Audit', '**Second** comment.\r\n\r\n- A note\r\n\r\n## Audit'));
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), saved.content);
});

test('all editor and comment mutations reject stale revisions without modifying the external version', async (t) => {
  const app = await appFor(t, { '01-example.md': '# 01: Example\nStatus: open\n\n## Notes\nOriginal.\n' });
  const [issue] = await app.load();
  const external = issue.content + '\n## Comments\nExternal comment.\n';
  await writeFile(join(app.folder, issue.path), external);
  for (const fields of [{ title: 'Draft' }, { status: 'resolved' }, { dependencies: [] }, { body: 'Draft body' }]) {
    assert.equal((await app.send('edit', issue, { changes: fields })).status, 409);
  }
  assert.equal((await app.send('comment', issue, { comment: 'Draft comment' })).status, 409);
  assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), external);
  const [latest] = await app.load();
  const simultaneous = await Promise.all([
    app.send('edit', latest, { changes: { title: 'Winner' } }), app.send('comment', latest, { comment: 'Maybe winner' }),
  ]);
  assert.deepEqual(simultaneous.map((response) => response.status).sort(), [200, 409]);
});

test('invalid editor requests alter no file and comments can create a heading and append repeatedly', async (t) => {
  const original = '# Example\n**Status:** ready-for-agent';
  const app = await appFor(t, { '01-example.md': original, '02-other.md': '# 02: Other\nStatus: needs-info\n' });
  let issue = (await app.load()).find((candidate) => candidate.number === '01');
  for (const changes of [{}, { title: '' }, { title: 'two\nlines' }, { title: '   ' }, { status: 'resolved' },
    { dependencies: [issue.id] }, { body: '## Comments\nCannot replace comments.' }, { body: '```\nUnclosed' }, { extra: true }]) {
    assert.ok([400, 422].includes((await app.send('edit', issue, { changes })).status), JSON.stringify(changes));
    assert.equal(await readFile(join(app.folder, issue.path), 'utf8'), original);
  }
  for (const comment of ['', '  ', '## Another section', '```\nUnclosed']) {
    assert.ok([400, 422].includes((await app.send('comment', issue, { comment })).status));
  }
  assert.equal((await app.send('edit', issue, { changes: { title: 'Changed' } }, { 'X-Mdkanban-Session': '' })).status, 403);
  assert.equal((await app.send('comment', issue, { comment: 'No' }, { Origin: 'https://example.org' })).status, 403);
  let response = await app.send('comment', issue, { comment: 'First.' });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.equal(issue.content, original + '\n\n## Comments\n\nFirst.\n');
  response = await app.send('comment', issue, { comment: '### Note\nSecond.' });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.equal(issue.content, original + '\n\n## Comments\n\nFirst.\n\n### Note\nSecond.\n');
  response = await app.send('edit', issue, { changes: { dependencies: ['02-other.md'] } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content, issue.content.replace('ready-for-agent\n', 'ready-for-agent\n**Blocked by:** 02\n'));
});

test('numbered body examples never replace the issue title, and empty body insertion preserves metadata', async (t) => {
  const app = await appFor(t, { '01-example.md': '# Example\nStatus: ready-for-agent' });
  let [issue] = await app.load();
  let response = await app.send('edit', issue, { changes: { body: '## Notes\n\n```md\n# 99: Example in code\n```' } });
  assert.equal(response.status, 200);
  issue = await response.json();
  assert.equal(issue.title, 'Example');
  assert.equal(issue.number, '01');
  assert.equal(issue.content, '# Example\nStatus: ready-for-agent\n\n## Notes\n\n```md\n# 99: Example in code\n```');
});

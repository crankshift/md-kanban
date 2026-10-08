import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../dist/server/server.js';
import { createBoardWatcher } from '../dist/server/watcher.js';
import { fixture } from './fixtures.mjs';
import { launch } from './helpers.mjs';
import { connectEvents, pause } from './events.mjs';

const cli = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));
const files = {
  '.scratch/alpha/issues/01-start.md': '# 01: Start\n\nStatus: ready-for-agent\nBlocked by: None\n',
  '.scratch/alpha/issues/02-next.md': '# 02: Next\n\nStatus: needs-info\nBlocked by: 01\n',
  '.scratch/alpha/spec.md': '# Spec\n\nStatus: draft\n',
  'docs/adr/0001-example.md': '# 0001: Example\n\nStatus: accepted\n',
};

const watchers = () => process.getActiveResourcesInfo().filter((name) => /FSEvent|FSWatcher/.test(name)).length;
async function released(expected) {
  for (let attempt = 0; attempt < 100 && watchers() !== expected; attempt++) await pause(20);
  assert.equal(watchers(), expected, 'native watchers are released');
}

async function connected(t, initial = files) {
  const folder = await fixture(t, initial);
  const app = await startServer(folder);
  t.after(() => app.close());
  const stream = await connectEvents(t, app.url);
  await stream.waitForChanges(0);
  const board = async () => (await (await fetch(`${app.url}/api/issues`)).json()).issues;
  return { folder, app, stream, board, url: app.url };
}
const issueAt = (issues, path) => issues.find((issue) => issue.path === path);

test('the event stream announces itself and carries the same-origin protections', async (t) => {
  const { url, stream } = await connected(t);
  assert.equal(stream.response.statusCode, 200);
  assert.match(stream.response.headers['content-type'], /^text\/event-stream/);
  assert.equal(stream.response.headers['cache-control'], 'no-store');
  for (let attempt = 0; attempt < 50 && !stream.events.length; attempt++) await pause(20);
  assert.deepEqual(stream.events[0], { name: 'ready', data: { version: 0 } });
  const foreign = await fetch(`${url}/api/events`, { headers: { Origin: 'http://example.org' } });
  assert.equal(foreign.status, 403);
  assert.equal((await fetch(`${url}/api/events`, { method: 'POST' })).status, 405);
});

test('agent-like writes, creations, renames, deletions and atomic replacements refresh the board', async (t) => {
  const { folder, stream, board } = await connected(t);
  const dir = join(folder, '.scratch/alpha/issues');
  let changes = 0;
  const expectChange = async (action, check) => {
    await action();
    await stream.waitForChanges(++changes);
    check(await board());
  };
  await expectChange(() => writeFile(join(dir, '01-start.md'), '# 01: Start\n\nStatus: needs-info\nBlocked by: None\n'),
    (issues) => assert.equal(issueAt(issues, '.scratch/alpha/issues/01-start.md').status, 'needs-info'));
  await expectChange(() => writeFile(join(dir, '03-created.md'), '# 03: Created\n\nStatus: needs-triage\n'),
    (issues) => assert.equal(issueAt(issues, '.scratch/alpha/issues/03-created.md').title, 'Created'));
  await expectChange(() => rename(join(dir, '03-created.md'), join(dir, '03-renamed.md')),
    (issues) => {
      assert.equal(issueAt(issues, '.scratch/alpha/issues/03-created.md'), undefined);
      assert.ok(issueAt(issues, '.scratch/alpha/issues/03-renamed.md'));
    });
  await expectChange(async () => {
    await writeFile(join(folder, 'replacement.tmp'), '# 02: Next\n\nStatus: ready-for-human\nBlocked by: 01\n');
    await rename(join(folder, 'replacement.tmp'), join(dir, '02-next.md'));
  }, (issues) => assert.equal(issueAt(issues, '.scratch/alpha/issues/02-next.md').status, 'ready-for-human'));
  await expectChange(() => rm(join(dir, '03-renamed.md')),
    (issues) => assert.equal(issueAt(issues, '.scratch/alpha/issues/03-renamed.md'), undefined));
  await expectChange(async () => {
    await mkdir(join(folder, 'docs/tickets/gamma/issues'), { recursive: true });
    await writeFile(join(folder, 'docs/tickets/gamma/issues/01-review.md'), '# 01: Review\n\nStatus: resolved\nType: task\n');
  }, (issues) => assert.equal(issueAt(issues, 'docs/tickets/gamma/issues/01-review.md').workflow, null));
  await expectChange(() => writeFile(join(dir, '01-start.md'), '# 01: Start\n\nStatus: finished\n'), (issues) => {
    const broken = issueAt(issues, '.scratch/alpha/issues/01-start.md');
    assert.equal(broken.workflow, null);
    assert.deepEqual(broken.diagnostics, [], 'an unfamiliar authored status is ordinary data');
  });
});

test('supporting Markdown refreshes queries, bursts publish once and ignored folders publish nothing', async (t) => {
  const { folder, stream } = await connected(t);
  await writeFile(join(folder, '.scratch/alpha/spec.md'), '# Spec\n\nStatus: approved\n');
  await writeFile(join(folder, 'docs/adr/0001-example.md'), '# 0001: Example\n\nStatus: superseded\n');
  await writeFile(join(folder, 'docs/guide.md'), '# Guide\n\nStatus: open\n');
  await mkdir(join(folder, 'node_modules/example/issues'), { recursive: true });
  await writeFile(join(folder, 'node_modules/example/issues/01-vendor.md'), '# 01: Vendor\n\nStatus: open\n');
  await pause(600);
  assert.equal(stream.changes(), 1, 'supporting Markdown invalidates the query cache');
  for (const status of ['needs-info', 'ready-for-human', 'wontfix', 'needs-triage']) {
    await writeFile(join(folder, '.scratch/alpha/issues/01-start.md'), `# 01: Start\n\nStatus: ${status}\nBlocked by: None\n`);
  }
  await stream.waitForChanges(2);
  await pause(600);
  assert.equal(stream.changes(), 2, 'a burst of writes settles into one notification');
});

test('app writes notify once with a refresh that matches the saved result', async (t) => {
  const { url, stream, board, folder } = await connected(t);
  const { sessionToken } = await (await fetch(`${url}/api/context`)).json();
  const issue = issueAt(await board(), '.scratch/alpha/issues/01-start.md');
  const response = await fetch(`${url}/api/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': sessionToken },
    body: JSON.stringify({ path: issue.path, expectedRevision: issue.revision, status: 'needs-info' }),
  });
  const saved = await response.json();
  await stream.waitForChanges(1);
  await pause(500);
  assert.equal(stream.changes(), 1, 'locks and temporary files do not add notifications');
  assert.deepEqual(issueAt(await board(), issue.path), saved);
  assert.match(await readFile(join(folder, issue.path), 'utf8'), /Status: needs-info/);
  const stale = await fetch(`${url}/api/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': sessionToken },
    body: JSON.stringify({ path: issue.path, expectedRevision: issue.revision, status: 'wontfix' }),
  });
  assert.equal(stale.status, 409, 'writes based on the pre-refresh revision stay rejected');
});

test('polling fallback reports the same changes and releases its timer', async (t) => {
  const folder = await fixture(t, files);
  const watcher = await createBoardWatcher(folder, { native: false, pollMs: 40 });
  t.after(() => watcher.close());
  const seen = [];
  const unsubscribe = watcher.subscribe((version) => seen.push(version));
  await writeFile(join(folder, '.scratch/alpha/issues/01-start.md'), '# 01: Start\n\nStatus: wontfix\n');
  for (let attempt = 0; attempt < 100 && !seen.length; attempt++) await pause(20);
  assert.deepEqual(seen, [1]);
  unsubscribe();
  watcher.close();
  await writeFile(join(folder, '.scratch/alpha/issues/01-start.md'), '# 01: Start\n\nStatus: needs-info\n');
  await pause(200);
  assert.deepEqual(seen, [1], 'a closed watcher publishes nothing');
});

test('stopping the server ends event streams and releases the watcher', async (t) => {
  const folder = await fixture(t, files);
  const before = watchers();
  const app = await startServer(folder);
  const stream = await connectEvents(t, app.url);
  t.after(() => app.close());
  assert.ok(watchers() > before, 'the folder is observed while running (Node may use one watcher per directory)');
  await app.close();
  await stream.waitForEnd();
  await app.close(); // Closing again is harmless.
  await writeFile(join(folder, '.scratch/alpha/issues/01-start.md'), '# 01: Start\n\nStatus: wontfix\n');
  await pause(300);
  assert.equal(stream.changes(), 0);
  assert.equal(app.server.listening, false);
  await released(before);
});

test('a plain server.close also releases the watcher', async (t) => {
  const folder = await fixture(t, files);
  const before = watchers();
  const app = await startServer(folder);
  t.after(() => app.close());
  await connectEvents(t, app.url);
  assert.ok(watchers() > before);
  await new Promise((resolve) => { app.server.close(resolve); app.server.closeAllConnections(); });
  await released(before);
});

test('the CLI exits promptly on SIGTERM while a browser tab holds an event stream', { timeout: 15000 }, async (t) => {
  const folder = await fixture(t, files);
  const app = await launch(t, cli, folder, ['--no-open']);
  const url = await app.url;
  const stream = await connectEvents(t, url);
  app.child.kill('SIGTERM');
  const result = await app.exit;
  assert.equal(result.code, 0);
  await stream.waitForEnd();
  await assert.rejects(fetch(url));
});

test('a removed and recreated root is noticed even if the native watcher stops reporting', async (t) => {
  const { folder, stream, board } = await connected(t);
  await rm(folder, { recursive: true });
  await stream.waitForChanges(1);
  await mkdir(join(folder, '.scratch/alpha/issues'), { recursive: true });
  await writeFile(join(folder, '.scratch/alpha/issues/01-start.md'), '# 01: Start\n\nStatus: wontfix\n');
  await stream.waitForChanges(2, 10000);
  assert.equal(issueAt(await board(), '.scratch/alpha/issues/01-start.md').status, 'wontfix');
});

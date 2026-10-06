import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, realpath, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './helpers.mjs';
import { connectEvents, pause } from './events.mjs';

const checkout = fileURLToPath(new URL('../', import.meta.url));

test('installed tarball serves its own frontend against a separate folder and shuts down', { timeout: 60000 }, async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'mdboard-package-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const installation = join(temporary, 'installation');
  const folder = join(temporary, 'selected issues');
  await mkdir(installation);
  await mkdir(folder);
  // Deliberately collide with package files: selected-folder content must never be served.
  await writeFile(join(folder, 'index.html'), 'PRIVATE_FOLDER_SENTINEL');
  await writeFile(join(folder, '01-example.md'), '# 01: Packaged issue\n\nStatus: ready-for-agent\n');
  await writeFile(join(folder, 'spec.md'), '# Packaged specification\n\nStatus: proposed\n');
  const tarball = join(temporary, 'mdboard.tgz');
  execFileSync('pnpm', ['pack', '--out', tarball], { cwd: checkout, stdio: 'pipe' });
  const { packageManager } = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
  await writeFile(join(installation, 'package.json'), JSON.stringify({ private: true, packageManager }));
  execFileSync('pnpm', ['add', '--offline', '--ignore-scripts', tarball], { cwd: installation, stdio: 'pipe' });
  const packageRoot = join(installation, 'node_modules/mdboard');
  const packageFiles = await readdir(packageRoot, { recursive: true });
  assert.ok(!packageFiles.some((path) => /(?:^|[/\\])prototype(?:[/\\]|$)|prototype-demo/.test(path)), 'packed package contains no prototype files');
  const packed = JSON.parse(await readFile(join(installation, 'node_modules/mdboard/package.json'), 'utf8'));
  assert.deepEqual(Object.keys(packed.dependencies).sort(), ['open', 'zod'], 'client packages are bundled build dependencies');
  const cli = process.platform === 'win32'
    ? join(installation, 'node_modules', 'mdboard', 'dist', 'server', 'cli.js')
    : join(installation, 'node_modules', '.bin', 'mdboard');
  const app = await launch(t, cli, installation, [folder, '--no-open']);
  const url = await app.url;
  const context = await (await fetch(`${url}/api/context`)).json();
  assert.equal(context.folder, folder);
  assert.match(context.sessionToken, /^[a-f0-9]{64}$/);
  const board = await (await fetch(`${url}/api/issues`)).json();
  assert.equal(board.issues.length, 1);
  assert.equal(board.issues[0].title, 'Packaged issue');
  assert.equal(board.issues[0].workflow, 'implementation');
  // Supporting documents stay inside the selected folder and are never cards.
  const { documents } = await (await fetch(`${url}/api/documents`)).json();
  assert.deepEqual(documents.map((document) => [document.kind, document.path]), [['specification', 'spec.md']]);
  assert.equal((await (await fetch(`${url}/api/document?path=spec.md`)).json()).title, 'Packaged specification');
  const escape = new URLSearchParams({ from: '01-example.md', href: '../outside.md' });
  assert.equal((await (await fetch(`${url}/api/document-link?${escape}`)).json()).status, 'unavailable');
  const saved = await fetch(`${url}/api/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': context.sessionToken, Origin: url },
    body: JSON.stringify({ path: board.issues[0].path, expectedRevision: board.issues[0].revision, status: 'needs-info' }),
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).status, 'needs-info');
  assert.equal(await readFile(join(folder, '01-example.md'), 'utf8'), '# 01: Packaged issue\n\nStatus: needs-info\n');
  const [target] = await (await fetch(`${url}/api/creation-targets`)).json();
  const created = await fetch(`${url}/api/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': context.sessionToken, Origin: url },
    body: JSON.stringify({ container: target.container, expectedRevision: target.revision, workflow: target.workflow,
      title: 'Created from package', status: 'needs-triage', body: '## Outcome\nPortable packaged creation.', dependencies: ['01-example.md'] }),
  });
  assert.equal(created.status, 201);
  const newIssue = await created.json();
  assert.equal(newIssue.path, '02-created-from-package.md');
  assert.equal(await readFile(join(folder, newIssue.path), 'utf8'), newIssue.content);
  assert.equal((await (await fetch(`${url}/api/issues`)).json()).issues.length, 2);
  // The installed server observes writes made outside the app and releases the stream at shutdown.
  await pause(500); // Let notifications for the app's own writes settle first.
  const stream = await connectEvents(t, url);
  const echoes = stream.changes();
  await writeFile(join(folder, '03-external.md'), '# 03: External\n\nStatus: needs-triage\n');
  await stream.waitForChanges(echoes + 1);
  assert.equal((await (await fetch(`${url}/api/issues`)).json()).issues.length, 3);
  const html = await (await fetch(url)).text();
  assert.match(html, /<title>mdboard<\/title>/);
  assert.doesNotMatch(html, /PRIVATE_FOLDER_SENTINEL|main\.tsx|@vite\/client/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)];
  assert.ok(assets.length >= 2, 'Built JS and CSS are present');
  for (const [, asset] of assets) {
    const response = await fetch(`${url}${asset}`);
    assert.equal(response.status, 200);
    const content = await response.text();
    assert.ok(content.length > 0);
    if (asset.endsWith('.js')) assert.doesNotMatch(content, /mountPrototype|useProtoBoard|simulateAgentEdit|Previous variant|PROTOTYPE — throwaway/, 'production bundle excludes prototype code');
  }
  assert.equal((await fetch(`${url}/package.json`)).status, 404);
  const deep = await fetch(`${url}/board/alpha?issue=01-example.md`);
  assert.equal(deep.status, 200);
  assert.match(await deep.text(), /<title>mdboard<\/title>/);
  assert.equal((await fetch(`${url}/api/unknown`)).status, 404);
  assert.equal((await fetch(`${url}/assets/missing.js`)).status, 404);
  assert.equal((await fetch(`${url}/api/context`, { method: 'POST' })).status, 405);
  app.child.kill('SIGTERM');
  assert.equal((await app.exit).code, 0);
  await stream.waitForEnd();
  await assert.rejects(fetch(url));
});

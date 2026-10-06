import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './helpers.mjs';

const checkout = fileURLToPath(new URL('../', import.meta.url));

test('installed tarball serves its own frontend against a separate folder and shuts down', { timeout: 60000 }, async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'md-kanban-package-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const installation = join(temporary, 'installation');
  const folder = join(temporary, 'selected issues');
  await mkdir(installation);
  await mkdir(folder);
  // Deliberately collide with package files: selected-folder content must never be served.
  await writeFile(join(folder, 'index.html'), 'PRIVATE_FOLDER_SENTINEL');
  const tarball = join(temporary, 'md-kanban.tgz');
  execFileSync('pnpm', ['pack', '--out', tarball], { cwd: checkout, stdio: 'pipe' });
  await writeFile(join(installation, 'package.json'), JSON.stringify({ private: true }));
  execFileSync('pnpm', ['add', '--offline', '--ignore-scripts', tarball], { cwd: installation, stdio: 'pipe' });
  const cli = process.platform === 'win32'
    ? join(installation, 'node_modules', 'md-kanban', 'dist', 'server', 'cli.js')
    : join(installation, 'node_modules', '.bin', 'md-kanban');
  const app = await launch(t, cli, installation, [folder, '--no-open']);
  const url = await app.url;
  const context = await fetch(`${url}/api/context`);
  assert.deepEqual(await context.json(), { folder });
  const html = await (await fetch(url)).text();
  assert.match(html, /<title>md-kanban<\/title>/);
  assert.doesNotMatch(html, /PRIVATE_FOLDER_SENTINEL|main\.tsx|@vite\/client/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)];
  assert.ok(assets.length >= 2, 'Built JS and CSS are present');
  for (const [, asset] of assets) {
    const response = await fetch(`${url}${asset}`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 0);
  }
  assert.equal((await fetch(`${url}/package.json`)).status, 404);
  assert.equal((await fetch(`${url}/api/context`, { method: 'POST' })).status, 405);
  app.child.kill('SIGTERM');
  assert.equal((await app.exit).code, 0);
  await assert.rejects(fetch(url));
});

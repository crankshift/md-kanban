import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, boardFiles } from './fixtures.mjs';
import { launch } from './helpers.mjs';

const cli = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));
test('CLI exposes real read-only boards and keeps Markdown files untouched', { timeout: 15000 }, async (t) => {
  const folder = await fixture(t, boardFiles);
  const app = await launch(t, cli, folder, ['--no-open']);
  const url = await app.url;
  const response = await fetch(`${url}/api/issues`);
  assert.equal(response.status, 200);
  const board = await response.json();
  assert.equal(board.issues.length, 6);
  assert.equal(board.issues.filter((issue) => issue.workflow === 'implementation').length, 3);
  assert.equal(board.issues.filter((issue) => issue.workflow === 'wayfinding').length, 2);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await fetch(`${url}/api/issues`, { method, body: '{}' })).status, 405);
  }
  assert.equal((await fetch(`${url}/api/issues?path=../../private.md`)).status, 200);
  assert.equal((await fetch(`${url}/.scratch/alpha/issues/02-start.md`)).status, 404);
  for (const [path, content] of Object.entries(boardFiles)) assert.equal(await readFile(join(folder, path), 'utf8'), content);
  app.child.kill('SIGTERM');
  assert.equal((await app.exit).code, 0);
});

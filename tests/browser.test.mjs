import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './helpers.mjs';
const cli = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));

test('browser-opening failure provides a manual URL and keeps the server available', { skip: process.platform !== 'darwin' }, async (t) => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'mdkanban-opener-')));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, 'open'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const app = await launch(t, cli, cwd, [], { ...process.env, PATH: cwd });
  const url = await app.url;
  for (let attempts = 0; attempts < 100 && !app.output().stderr.includes('manually'); attempts++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(app.output().stderr.includes(`Open ${url} manually`));
  assert.equal((await fetch(url)).status, 200);
  app.child.kill('SIGINT');
  assert.equal((await app.exit).code, 0);

  const headless = await launch(t, cli, cwd, ['--no-open'], { ...process.env, PATH: cwd });
  await headless.url;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(headless.output().stderr, '');
  headless.child.kill('SIGTERM');
  assert.equal((await headless.exit).code, 0);
});

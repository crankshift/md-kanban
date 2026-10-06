import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch } from './helpers.mjs';

const cli = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));

test('CLI selects caller cwd and serves the app from package assets', { timeout: 10000 }, async (t) => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'md-kanban-launch-')));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const app = await launch(t, cli, folder, ['--no-open']);
  const url = await app.url;
  assert.deepEqual(await (await fetch(`${url}/api/context`)).json(), { folder });
  assert.match(await (await fetch(url)).text(), /<title>md-kanban<\/title>/);
  app.child.kill('SIGTERM');
  assert.equal((await app.exit).code, 0);
  await assert.rejects(fetch(url));
});

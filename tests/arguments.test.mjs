import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './helpers.mjs';
const cli = fileURLToPath(new URL('../dist/server/cli.js', import.meta.url));

test('CLI resolves omitted, dot, relative, absolute, and option-like folders from caller cwd', { timeout: 10000 }, async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'md-kanban-args-'));
  const cwd = await realpath(temporary);
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, 'issues with spaces'));
  await mkdir(join(cwd, '-issues'));
  for (const [args, expected] of [
    [[], cwd], [['./'], cwd], [['issues with spaces'], join(cwd, 'issues with spaces')],
    [[join(cwd, 'issues with spaces')], join(cwd, 'issues with spaces')],
    [['--', '-issues'], join(cwd, '-issues')],
  ]) {
    const app = await launch(t, cli, cwd, ['--no-open', ...args]);
    const url = await app.url;
    assert.deepEqual(await (await fetch(`${url}/api/context`)).json(), { folder: expected });
    app.child.kill('SIGINT');
    assert.equal((await app.exit).code, 0);
  }
});

test('CLI rejects nonexistent paths, files, excess arguments, and unknown flags before listening', { timeout: 10000 }, async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'md-kanban-invalid-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, 'file.md'), 'Public test fixture');
  for (const args of [['missing'], ['file.md'], ['one', 'two'], ['--unknown']]) {
    const app = await launch(t, cli, cwd, args);
    const result = await app.exit;
    assert.equal(result.code, 1);
    assert.match(result.stderr, /md-kanban:/);
    assert.doesNotMatch(result.stdout, /http:/);
  }
});


test('CLI reports inaccessible folders before startup', { skip: process.platform === 'win32' || process.getuid?.() === 0, timeout: 10000 }, async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'md-kanban-permissions-'));
  const folder = join(cwd, 'restricted');
  await mkdir(folder);
  t.after(async () => {
    await chmod(folder, 0o700);
    await rm(cwd, { recursive: true, force: true });
  });
  await chmod(folder, 0o000);
  const app = await launch(t, cli, cwd, [folder, '--no-open']);
  const result = await app.exit;
  assert.equal(result.code, 1);
  assert.match(result.stderr, /existing, readable directory/);
  assert.doesNotMatch(result.stdout, /http:/);
});

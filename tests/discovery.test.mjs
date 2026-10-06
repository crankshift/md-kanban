import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import fs, { symlink, readFile, rename, unlink } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { discoverIssues } from '../dist/server/discovery.js';
import { fixture, boardFiles } from './fixtures.mjs';

test('discovers both workflows across repository locations without documents or duplicates', async (t) => {
  const root = await fixture(t, boardFiles);
  const { issues, warnings } = await discoverIssues(root);
  assert.deepEqual(warnings, []);
  assert.equal(issues.length, 6);
  assert.equal(new Set(issues.map((issue) => issue.id)).size, 6);
  assert.deepEqual(issues.filter((issue) => issue.number === '01').map((issue) => issue.feature), ['beta', 'delta', 'gamma']);
  assert.equal(issues.find((issue) => issue.title === 'Broken').workflow, null);
  const start = issues.find((issue) => issue.title === 'Start');
  assert.equal(start.location, '.scratch');
  assert.equal(start.container, '.scratch/alpha/issues');
  assert.equal(start.content, await readFile(join(root, start.path), 'utf8'));
  assert.deepEqual(issues.filter((issue) => issue.feature === 'alpha').map((issue) => issue.number), ['02', '03', '10']);
});

test('supports tracker, feature, docs/tickets and direct issue-folder launches', async (t) => {
  const root = await fixture(t, boardFiles);
  for (const [selected, titles] of [
    ['.scratch', ['Start', 'Broken', 'Later', 'Question']],
    ['docs', ['Delta', 'Review']],
    ['docs/tickets', ['Review']],
    ['.scratch/alpha', ['Start', 'Broken', 'Later']],
    ['.scratch/alpha/issues', ['Start', 'Broken', 'Later']],
    ['.scratch/beta/tickets', ['Question']],
    ['docs/adr', []],
  ]) {
    const board = await discoverIssues(join(root, selected));
    assert.deepEqual(board.issues.map((issue) => issue.title), titles, selected);
    assert.ok(board.issues.every((issue) => !issue.path.startsWith('../')));
  }
  const arbitrary = await fixture(t, {
    'chosen/01-example.md': '# 01: Direct\nStatus: wontfix\n',
    'chosen/heading.md': '# 02: Heading only\nStatus: claimed\nType: prototype\n',
    'chosen/notes.md': '# Ordinary notes\nStatus: open\n',
  });
  assert.deepEqual((await discoverIssues(join(arbitrary, 'chosen'))).issues.map((issue) => issue.title), ['Direct', 'Heading only']);
});

test('never follows file or directory symlinks outside or inside the selected root', async (t) => {
  const outside = await fixture(t, { 'issues/01-outside.md': '# 01: Outside\nStatus: open\n' });
  const root = await fixture(t, boardFiles);
  await symlink(join(outside, 'issues'), join(root, '.scratch/escaped'), 'dir');
  await symlink(join(outside, 'issues/01-outside.md'), join(root, '.scratch/alpha/issues/04-escaped.md'));
  await symlink(join(root, '.scratch/alpha/issues'), join(root, 'docs/alias'), 'dir');
  const board = await discoverIssues(root);
  assert.equal(board.issues.length, 6);
  assert.equal(board.issues.some((issue) => issue.content?.includes('Outside')), false);
  const direct = await discoverIssues(join(root, '.scratch/alpha/issues/..', 'issues'));
  assert.equal(direct.issues.length, 3);
});

test('sorts by feature then issue number even when the feature name repeats across locations', async (t) => {
  const root = await fixture(t, {
    '.scratch/example/issues/10-ten.md': '# 10: Ten\nStatus: open\n',
    'docs/example/tickets/02-two.md': '# 02: Two\nStatus: open\n',
  });
  assert.deepEqual((await discoverIssues(root)).issues.map((issue) => issue.title), ['Two', 'Ten']);
});

test('a selected issue folder still reads its files when it contains supporting docs', async (t) => {
  const root = await fixture(t, {
    'issues/01-one.md': '# 01: One\nStatus: open\n',
    'issues/docs/guide.md': '# Guide\n',
    'chosen/01-two.md': '# 01: Two\nStatus: ready-for-agent\n',
    'chosen/docs/guide.md': '# Guide\n',
  });
  assert.deepEqual((await discoverIssues(join(root, 'issues'))).issues.map((issue) => issue.title), ['One']);
  assert.deepEqual((await discoverIssues(join(root, 'chosen'))).issues.map((issue) => issue.title), ['Two']);
});


test('rejects an external file opened during a temporary ancestor symlink swap', async (t) => {
  const outside = await fixture(t, { '01-test.md': '# 01: Outside\nStatus: open\n' });
  const root = await fixture(t, { 'issues/01-test.md': '# 01: Inside\nStatus: open\n' });
  const originalOpen = fs.open;
  t.mock.method(fs, 'open', async (path, ...args) => {
    await rename(join(root, 'issues'), join(root, 'saved'));
    await symlink(outside, join(root, 'issues'), 'dir');
    try { return await originalOpen(path, ...args); }
    finally {
      await unlink(join(root, 'issues'));
      await rename(join(root, 'saved'), join(root, 'issues'));
    }
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const board = await discoverIssues(root);
  assert.equal(board.issues.some((issue) => issue.content?.includes('Outside')), false);
});

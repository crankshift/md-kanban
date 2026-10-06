import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIssue } from '../dist/server/issues.js';

const context = { path: '.scratch/example/issues/02-ship.md', location: '.scratch', feature: 'example', container: '.scratch/example/issues' };

test('parses a bold-key implementation issue without altering Markdown or dependency text', () => {
  const content = '# 02: Ship it\r\n\r\n**Status:** ready-for-agent\r\n**Blocked by:** 01 — Launch, 03: Review\r\n\r\n## Unknown\r\nKeep me.\r\n';
  const issue = parseIssue(context, content);
  assert.equal(issue.workflow, 'implementation');
  assert.equal(issue.status, 'ready-for-agent');
  assert.equal(issue.number, '02');
  assert.equal(issue.title, 'Ship it');
  assert.equal(issue.dependencyText, '01 — Launch, 03: Review');
  assert.equal(issue.content, content);
  assert.deepEqual(issue.diagnostics, []);
  assert.match(issue.revision, /^[a-f0-9]{64}$/);
});

test('keeps uncertain and malformed issues in Needs attention without guessing', () => {
  for (const [content, reason] of [
    ['# 02: Missing\n\n## Body\nStatus: open\n', /Missing status/],
    ['# 02: Unknown\n\nStatus: done\n', /Unknown status/],
    ['# 02: Conflict\n\nStatus: ready-for-agent\nType: research\n', /Ambiguous workflow/],
    ['# 02: Duplicate\n\nStatus: open\n**Status:** resolved\n', /Duplicate status/],
    ['# 03: Wrong number\n\nStatus: open\n', /numbers disagree/],
    ['# 02: Malformed\n\nStatus = open\n', /Malformed metadata/],
    ['# 02: Type\n\nStatus: open\nType: mystery\n', /Unknown wayfinding type/],
    ['Status: open\n', /Missing issue title/],
  ]) {
    const issue = parseIssue(context, content);
    assert.equal(issue.workflow, null);
    assert.match(issue.diagnostics.join(' '), reason);
    assert.equal(issue.content, content);
  }
});

test('parses heading numbers, wayfinding types, no-dependency text and body examples', () => {
  const issue = parseIssue({ ...context, path: '.scratch/example/issues/investigate.md' }, '# 7 — Investigate\n\n**Status**: claimed\n**Type:** research\nBlocked by: None (first issue)\n\n## Notes\nStatus: resolved\n');
  assert.equal(issue.number, '7');
  assert.equal(issue.workflow, 'wayfinding');
  assert.equal(issue.type, 'research');
  assert.equal(issue.status, 'claimed');
  assert.equal(issue.dependencyText, 'None (first issue)');
  assert.deepEqual(issue.diagnostics, []);
  const changed = parseIssue(context, '# 02: Changed\nStatus: open\n');
  assert.notEqual(changed.revision, issue.revision);
});

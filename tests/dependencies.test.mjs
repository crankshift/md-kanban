import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverIssues } from '../dist/server/discovery.js';
import { resolveDependencies } from '../dist/server/dependencies.js';
import { fixture } from './fixtures.mjs';

test('resolves numbered references within the same feature and location, retaining their titles', async (t) => {
  const folder = await fixture(t, {
    '.scratch/alpha/issues/01-start.md': '# 01: Start\nStatus: ready-for-agent\n',
    '.scratch/alpha/issues/02-next.md': '# 02: Next\nStatus: ready-for-agent\nBlocked by: 1 — Start, 99: Missing\n',
    '.scratch/beta/issues/01-other.md': '# 01: Other feature\nStatus: resolved\n',
    'docs/alpha/issues/01-other.md': '# 01: Other location\nStatus: resolved\n',
  });
  const { issues } = await discoverIssues(folder);
  const source = issues.find((issue) => issue.title === 'Next');
  const dependencies = resolveDependencies(source, issues);
  assert.equal(dependencies[0].reference, '1 — Start');
  assert.equal(dependencies[0].kind, 'linked');
  assert.equal(dependencies[0].target.id, '.scratch/alpha/issues/01-start.md');
  assert.equal(dependencies[0].state, 'advisory');
  assert.equal(dependencies[1].kind, 'missing');
  assert.equal(dependencies[1].reference, '99: Missing');
  assert.equal(source.dependencyText, '1 — Start, 99: Missing');
});

test('preserves commas inside dependency titles while separating subsequent numbered and unsupported references', async (t) => {
  const folder = await fixture(t, {
    'issues/01-search.md': '# 01: Search, filters, and results\nStatus: ready-for-agent\n',
    'issues/02-review.md': '# 02: Review\nStatus: ready-for-agent\n',
    'issues/03-next.md': '# 03: Next\nStatus: ready-for-agent\nBlocked by: #01 — Search, filters, and results, 02: Review, 99, undecided\n',
  });
  const { issues } = await discoverIssues(folder);
  const source = issues.find((issue) => issue.title === 'Next');
  const dependencies = resolveDependencies(source, issues);
  assert.deepEqual(dependencies.map((entry) => entry.kind), ['linked', 'linked', 'missing', 'unsupported']);
  assert.equal(dependencies[0].reference, '#01 — Search, filters, and results');
  assert.equal(dependencies[0].target.title, 'Search, filters, and results');
  assert.equal(dependencies[1].reference, '02: Review');
  assert.equal(dependencies[3].reference, 'undecided');
});

test('authored statuses never establish dependency completion; references remain advisory', async (t) => {
  const folder = await fixture(t, {
    '.scratch/effort/issues/01-question.md': '# 01: Question\nStatus: open\nBlocked by: 02, 03: Review, 04, 05, 06, later\n',
    '.scratch/effort/issues/02-done.md': '# 02: Decided\nStatus: resolved\n',
    '.scratch/effort/issues/03-review.md': '# 03: Review\nStatus: claimed\n',
    '.scratch/effort/issues/04-ready.md': '# 04: Ready\nStatus: ready-for-agent\n',
    '.scratch/effort/issues/05-invalid.md': '# 05: Invalid\nStatus: done\n',
    '.scratch/effort/issues/06-first.md': '# 06: First\nStatus: open\n',
    '.scratch/effort/tickets/6-second.md': '# 6: Second\nStatus: resolved\n',
  });
  const { issues } = await discoverIssues(folder);
  const source = issues.find((issue) => issue.title === 'Question');
  const dependencies = resolveDependencies(source, issues);
  assert.deepEqual(dependencies.slice(0, 4).map((entry) => entry.state), ['advisory', 'advisory', 'advisory', 'advisory']);
  assert.equal(dependencies[4].kind, 'ambiguous');
  assert.deepEqual(dependencies[4].candidates.map((issue) => issue.title).sort(), ['First', 'Second']);
  assert.equal(dependencies[5].kind, 'unsupported');
  const refreshed = issues.map((issue) => issue.title === 'Review' ? { ...issue, status: 'resolved' } : issue);
  assert.equal(resolveDependencies(source, refreshed)[1].state, 'advisory');
});

test('recognizes supported no-dependency text without discarding unknown or empty metadata', async (t) => {
  const folder = await fixture(t, { 'issues/01-alone.md': '# 01: Alone\nStatus: open\n' });
  const { issues } = await discoverIssues(folder);
  for (const dependencyText of [null, 'None', 'none', 'None (first issue)', 'None (can start immediately)']) {
    assert.deepEqual(resolveDependencies({ ...issues[0], dependencyText }, issues), []);
  }
  for (const dependencyText of ['', 'n/a', 'someday 01', 'None, 01']) {
    assert.ok(resolveDependencies({ ...issues[0], dependencyText }, issues).some((entry) => entry.kind === 'unsupported'));
  }
});

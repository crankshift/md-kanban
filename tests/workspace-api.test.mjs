import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, rename, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './fixtures.mjs';
import { startServer } from '../dist/server/server.js';

async function serve(t, files, selected = '') {
  const root = await fixture(t, files);
  const app = await startServer(join(root, selected));
  t.after(app.close);
  const get = async (route = '/api/documents') => {
    const response = await fetch(app.url + route);
    assert.equal(response.status, 200);
    return response.json();
  };
  return { ...app, root, get };
}

test('collection discovers ordinary Markdown recursively without issue conventions and retains unavailable paths', async (t) => {
  const app = await serve(t, {
    'docs/agents/guidance.markdown': '# Guidance\n\nNo properties needed.',
    '.scratch/archive/deep/free note.MD': 'An unconventional note without a heading.',
    'docs/huge.md': 'x'.repeat(2 * 1024 * 1024 + 1),
    'docs/locked.md': '# Unreadable',
    'docs/node_modules/pkg/private.md': '# Excluded',
    'README.md': '# Linked only',
    'docs/link.md': '# Source\n\n[Root](../README.md)',
  });
  await chmod(join(app.root, 'docs/locked.md'), 0);
  t.after(() => chmod(join(app.root, 'docs/locked.md'), 0o600).catch(() => {}));
  await symlink('../README.md', join(app.root, 'docs/alias.md'));
  await symlink('../.scratch', join(app.root, 'docs/folder-alias'));
  const collection = await app.get();
  assert.deepEqual(collection.documents.map((doc) => doc.path), [
    '.scratch/archive/deep/free note.MD', 'docs/agents/guidance.markdown', 'docs/alias.md', 'docs/huge.md', 'docs/link.md', 'docs/locked.md', 'README.md',
  ]);
  const byPath = (path) => collection.documents.find((doc) => doc.path === path);
  assert.equal(byPath('docs/agents/guidance.markdown').content, '# Guidance\n\nNo properties needed.');
  assert.deepEqual(byPath('docs/agents/guidance.markdown').properties, []);
  assert.equal(byPath('docs/huge.md').content, null);
  assert.match(byPath('docs/huge.md').diagnostics.join(' '), /2 MiB/);
  assert.equal(byPath('docs/alias.md').content, null);
  assert.match(byPath('docs/alias.md').diagnostics.join(' '), /symbolic links/i);
  if (process.getuid?.() !== 0) assert.equal(byPath('docs/locked.md').content, null);
  assert.ok(collection.edges.some(edge => edge.source === 'docs/link.md' && edge.target === 'README.md'), 'root Markdown belongs to the collection');
  assert.equal((await app.get('/api/document?path=README.md')).content, '# Linked only');
});

test('direct document-folder launch includes descendants and never expands to its parents', async (t) => {
  const app = await serve(t, {
    'docs/notes/plain.md': '# Plain', 'docs/notes/archive/free.markdown': '# Archive',
    'docs/parent.md': '# Parent', '.scratch/other.md': '# Other',
  }, 'docs/notes');
  assert.deepEqual((await app.get()).documents.map((doc) => doc.path), ['archive/free.markdown', 'plain.md']);
  assert.equal((await fetch(app.url + '/api/document?path=../parent.md')).status, 400);
  assert.equal((await app.get('/api/document-link?from=plain.md&href=../parent.md')).status, 'unavailable');
});

test('a direct folder with a docs child retains its own Markdown and all other descendants', async (t) => {
  const app = await serve(t, {
    'chosen/01-two.md': '# 01: Two\n\nStatus: open', 'chosen/plain.md': '# Plain',
    'chosen/docs/guide.md': '# Guide', 'chosen/archive/note.markdown': '# Archive',
    'outside.md': '# Outside',
  }, 'chosen');
  assert.deepEqual((await app.get()).documents.map((doc) => doc.path), ['01-two.md', 'archive/note.markdown', 'docs/guide.md', 'plain.md']);
});

test('optional properties retain arbitrary literal values, all occurrences and conflicts without parsing prose or examples', async (t) => {
  const app = await serve(t, {
    'docs/custom.md': '---\nStatus: moonlight\nStatus: sunrise\nFolder: authored\nEmpty: ""\nOwners: [Ada, Lin]\nDetails: {phase: 01}\n---\n# Custom\n\n**Status:** moonlight\n**Odd key**: strange\n\nOrdinary paragraph.\nStatus: body\n\n```md\nType: example\n```',
    'docs/bad.md': '---\nStatus: [broken\n---\n# Broken',
    'docs/prose.md': '# Prose\n\nA paragraph.\nStatus: prose\n',
    'docs/nested.md': '---\nDetails: {phase: first, phase: second}\n---\n# Nested duplicate',
  });
  const collection = await app.get();
  const doc = collection.documents.find((doc) => doc.path === 'docs/custom.md');
  assert.deepEqual(doc.properties.filter((entry) => entry.key === 'status').map((entry) => entry.value), ['moonlight', 'sunrise', 'moonlight']);
  assert.equal(doc.properties.find((entry) => entry.key === 'empty').value, '');
  assert.equal(doc.properties.find((entry) => entry.key === 'details').value, '{"phase":"01"}');
  assert.deepEqual(doc.properties.find((entry) => entry.key === 'owners').values, ['Ada', 'Lin']);
  assert.ok(doc.properties.every((entry) => typeof entry.raw === 'string'));
  assert.match(doc.diagnostics.join(' '), /conflict/i);
  assert.doesNotMatch(doc.diagnostics.join(' '), /unknown status|workflow/i);
  assert.deepEqual(collection.documents.find((doc) => doc.path === 'docs/prose.md').properties, []);
  assert.match(collection.documents.find((doc) => doc.path === 'docs/bad.md').diagnostics.join(' '), /frontmatter/i);
  const nested = collection.documents.find((doc) => doc.path === 'docs/nested.md');
  assert.equal(nested.properties[0].valid, false, 'nested duplicates never silently choose a value');
  assert.match(nested.properties[0].raw, /first, phase: second/);
});

test('relationships preserve real/reference link directions separately from explicitly targeted dependency properties', async (t) => {
  const app = await serve(t, {
    'docs/A.md': '# A\n\nNeeds: [B](B.md#part), 02, C.markdown\n\n[B][ref]\n[Missing](gone.md)\n[Escape](../../private.md)\n[bad](%EA.md)\n\n[ref]: B.md#part\n\n```md\n[Fake](C.markdown)\n```\n`[Fake](C.markdown)`',
    'docs/B.md': '# B\n\n[A](A.md)\n',
    'docs/C.markdown': '# C\n\nNeeds: 01, 02\n',
  });
  const { documents, edges } = await app.get();
  assert.deepEqual(edges.filter((edge) => edge.kind === 'link').map((edge) => [edge.source, edge.target]), [['docs/A.md', 'docs/B.md'], ['docs/B.md', 'docs/A.md']]);
  assert.deepEqual(edges.filter((edge) => edge.kind === 'dependency'), [
    { source: 'docs/A.md', target: 'docs/B.md', kind: 'dependency', property: 'needs' },
    { source: 'docs/A.md', target: 'docs/C.markdown', kind: 'dependency', property: 'needs' },
  ]);
  assert.match(documents[0].diagnostics.join(' '), /gone.md.*collection/);
  assert.match(documents[0].diagnostics.join(' '), /outside the selected folder/);
  assert.match(documents[0].diagnostics.join(' '), /malformed/);
  assert.deepEqual(documents[2].properties[0].values, ['01, 02']);
});

test('inaccessible directories report their paths without hiding an access problem', async (t) => {
  if (process.getuid?.() === 0) return t.skip('root bypasses mode bits');
  const app = await serve(t, { 'docs/closed/note.md': '# Hidden', 'docs/open.md': '# Visible' });
  await chmod(join(app.root, 'docs/closed'), 0);
  try {
    const collection = await app.get();
    assert.deepEqual(collection.documents.map((doc) => doc.path), ['docs/open.md']);
    assert.match(collection.warnings.join(' '), /Cannot read directory: docs\/closed/);
  } finally { await chmod(join(app.root, 'docs/closed'), 0o700); }
});

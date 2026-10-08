import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderBoard } from './render-board.mjs';

const files = {
  'docs/A.md': '# A\n\nStatus: moonlight\nFolder: authored\n\n[Read B](B.md#details)\n',
  'docs/B.md': '---\nStatus: No value\nOwner: Ada\n---\n# B\n\n## Details\nReference destination.\n',
  'docs/C.md': '# C\n\nStatus: sunrise\nStatus: moonlight\n\n[Also B][b]\n\n[b]: B.md\n',
  '.scratch/archive/notes.markdown': '# Unconventional\n\nBody needle.\n',
  '.scratch/work/issues/01-supported.md': '# 01: Supported\n\nStatus: ready-for-agent\n\nOriginal body.\n',
};
const button = (ui, label) => [...ui.document.querySelectorAll('button')].find((node) => (node.getAttribute('aria-label') ?? node.textContent) === label);
const reader = (ui) => ui.document.querySelector('[aria-label="Document reader"]');
const field = (ui, label) => ui.document.querySelector(`[aria-label="${label}"]`);

test('A finds ordinary documents, follows relative fragments/backlinks and restores URL filters', async (t) => {
  const ui = await renderBoard(t, files, true, {});
  await ui.until(() => button(ui, 'Read docs/A.md'), 'Markdown collection');
  assert.equal(ui.document.querySelectorAll('.file-row').length, 5);
  await ui.click(button(ui, 'Scope .scratch/archive'));
  assert.equal(ui.document.querySelectorAll('.file-row').length, 1);
  await ui.change(field(ui, 'Search Markdown files'), 'body needle');
  assert.ok(button(ui, 'Read .scratch/archive/notes.markdown'));
  await ui.click(button(ui, 'Clear'));
  await ui.click(button(ui, 'Read docs/A.md'));
  await ui.until(() => reader(ui)?.querySelector('a'), 'reader');
  await ui.click([...reader(ui).querySelectorAll('a')].find((node) => node.textContent === 'Read B'));
  await ui.until(() => reader(ui)?.textContent.includes('Reference destination.'), 'relative target');
  assert.equal(new URL(ui.document.defaultView.location.href).searchParams.get('anchor'), 'details');
  assert.match(reader(ui).querySelector('[aria-label="Backlinks"]').textContent, /A.*C/);
  assert.equal(field(ui, 'Issue title'), null, 'generic reading has no editor');
  await ui.click(button(ui, 'Back'));
  await ui.until(() => reader(ui)?.querySelector('h2')?.textContent === 'A', 'history returns to A');
});

test('folder expansion restores from the URL and Chakra navigation persists expansion changes', async (t) => {
  const ui = await renderBoard(t, { 'docs/deep/note.md': '# Nested', 'top.md': '# Top' }, true, {
    address: `http://localhost/?collapsed=${encodeURIComponent('["docs"]')}`,
  });
  await ui.until(() => button(ui, 'Expand docs'), 'restored folder expansion');
  assert.equal(button(ui, 'Scope docs/deep'), undefined);
  await ui.click(button(ui, 'Expand docs'));
  assert.ok(button(ui, 'Scope docs/deep'));
  assert.equal(new URL(ui.document.defaultView.location.href).searchParams.has('collapsed'), false);
  await ui.click(button(ui, 'Collapse docs'));
  assert.equal(new URL(ui.document.defaultView.location.href).searchParams.get('collapsed'), '["docs"]');
  assert.ok(button(ui, 'Read top.md'), 'direct folder retains top-level Markdown alongside docs');
});

test('generic Board separates missing, literal No value, conflicts and authored Folder from physical folder', async (t) => {
  const ui = await renderBoard(t, { ...files, 'docs/D.md': '# D\n\nStatus: No value (missing property)' }, true, { address: 'http://localhost/?view=board&group=property%3Astatus' });
  await ui.until(() => field(ui, 'Document board'), 'generic board');
  const columns = () => [...ui.document.querySelectorAll('.generic-column')];
  assert.equal(columns().filter((node) => node.querySelector('h2,h3').textContent === 'No value').length, 2);
  assert.match(ui.document.querySelector('[data-group="missing"]').textContent, /Missing property/, 'missing and literal values are visibly distinguishable');
  assert.ok(columns().some((node) => /Conflicting: sunrise · moonlight/.test(node.textContent)));
  assert.equal(ui.document.querySelector('[draggable="true"]'), null);
  await ui.change(field(ui, 'Group by'), 'Folder property');
  assert.ok(columns().some((node) => /^authored/.test(node.textContent)));
  await ui.change(field(ui, 'Group by'), 'Physical folder');
  assert.ok(columns().some((node) => /^docs/.test(node.textContent)));
  await ui.change(field(ui, 'Property'), 'Status');
  await ui.change(field(ui, 'Value'), '"moonlight"');
  assert.equal(ui.document.querySelectorAll('.generic-card').length, 1);
  assert.ok(button(ui, 'Read docs/A.md'));
  await ui.change(field(ui, 'Value'), 'No value (missing property)');
  assert.ok(button(ui, 'Read .scratch/archive/notes.markdown'));
  assert.equal(ui.document.querySelectorAll('.generic-card').length, 1);
  await ui.change(field(ui, 'Value'), '"No value"');
  assert.ok(button(ui, 'Read docs/B.md'));
  assert.equal(ui.document.querySelectorAll('.generic-card').length, 1);
  await ui.change(field(ui, 'Value'), '"No value (missing property)"');
  assert.ok(button(ui, 'Read docs/D.md'), 'an authored value matching the special label has a quoted, distinct choice');
  assert.equal(ui.document.querySelectorAll('.generic-card').length, 1);
});

test('live generic discovery, reader and relationships update across edits, atomic replacement, rename and removal', async (t) => {
  const ui = await renderBoard(t, files, true, { live: true });
  await ui.until(() => button(ui, 'Read docs/A.md'), 'collection');
  await ui.click(button(ui, 'Read docs/A.md'));
  await ui.until(() => reader(ui)?.querySelector('a'), 'initial reader');
  await writeFile(join(ui.folder, 'docs/replacement.tmp'), '# A updated\n\nOwner: Ada\n\n[Read C](C.md)');
  await rename(join(ui.folder, 'docs/replacement.tmp'), join(ui.folder, 'docs/A.md'));
  await ui.until(() => reader(ui)?.textContent.includes('A updated'), 'atomic reader update');
  await mkdir(join(ui.folder, '.scratch/new'));
  await writeFile(join(ui.folder, '.scratch/new/free.markdown'), '# Live ordinary file');
  await ui.until(() => button(ui, 'Read .scratch/new/free.markdown'), 'new Markdown extension');
  await rename(join(ui.folder, '.scratch/new/free.markdown'), join(ui.folder, '.scratch/new/renamed.markdown'));
  await ui.until(() => button(ui, 'Read .scratch/new/renamed.markdown'), 'rename');
  await rm(join(ui.folder, 'docs/A.md'));
  await ui.until(() => /Unavailable/.test(reader(ui)?.textContent), 'open removed file');
  assert.equal(new URL(ui.document.defaultView.location.href).searchParams.get('file'), 'docs/A.md', 'navigation survives deletion');
});

test('optional issue tools preserve a dirty draft during refresh and reject navigation until explicitly discarded', async (t) => {
  const ui = await renderBoard(t, files, true, { live: true });
  await ui.until(() => button(ui, 'Read .scratch/work/issues/01-supported.md'), 'collection');
  await ui.click(button(ui, 'Read .scratch/work/issues/01-supported.md'));
  await ui.until(() => button(ui, 'Issue tools'), 'optional tools');
  await ui.click(button(ui, 'Issue tools'));
  await ui.until(() => field(ui, 'Issue title'), 'issue editor');
  await ui.change(field(ui, 'Issue title'), 'Protected draft');
  await writeFile(join(ui.folder, '.scratch/work/issues/01-supported.md'), files['.scratch/work/issues/01-supported.md'].replace('Original body.', 'External body.'));
  await ui.until(() => /changed outside|Changed on disk/.test(ui.document.body.textContent), 'stale notice');
  assert.equal(field(ui, 'Issue title').value, 'Protected draft');
  let confirmations = 0;
  ui.document.defaultView.confirm = () => { confirmations++; return false; };
  await ui.click(button(ui, 'Close Issue details'));
  assert.equal(confirmations, 1);
  assert.equal(field(ui, 'Issue title').value, 'Protected draft');
  await ui.click(button(ui, 'Save issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, '.scratch/work/issues/01-supported.md'), 'utf8'), /# 01: Supported/);
  assert.equal(field(ui, 'Issue title').value, 'Protected draft');
});

test('production issue tools create, edit, comment and change supported status while ordinary documents stay read-only', async (t) => {
  const ui = await renderBoard(t, { 'issues/01-existing.md': '# 01: Existing\n\nStatus: ready-for-agent\n', 'ordinary.md': '# Ordinary' }, true, {});
  await ui.until(() => button(ui, 'Read ordinary.md'), 'collection');
  await ui.click(button(ui, 'Read ordinary.md'));
  await ui.until(() => reader(ui)?.textContent.includes('Ordinary'), 'ordinary reader');
  assert.equal(button(ui, 'Issue tools'), undefined);
  await ui.click(button(ui, 'New issue'));
  await ui.until(() => field(ui, 'New issue title'), 'issue creator');
  await ui.change(field(ui, 'New issue title'), 'Production creation');
  await ui.change(field(ui, 'New issue body'), 'Original created body.');
  await ui.click(button(ui, 'Create issue'));
  await ui.until(() => field(ui, 'Issue title')?.value === 'Production creation', 'saved creation tools');
  const path = new URL(ui.document.defaultView.location.href).searchParams.get('file');
  assert.equal(path, 'issues/02-production-creation.md');
  await ui.change(field(ui, 'Markdown body'), 'Updated created body.');
  await ui.click(button(ui, 'Save issue'));
  await ui.settled();
  await ui.change(field(ui, 'New comment'), 'A preserved production comment.');
  await ui.click(button(ui, 'Append comment'));
  await ui.settled();
  await ui.change(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]'), 'needs-info');
  await ui.settled();
  const saved = await readFile(join(ui.folder, path), 'utf8');
  assert.match(saved, /Status: needs-info/);
  assert.match(saved, /Updated created body\./);
  assert.match(saved, /## Comments\n\nA preserved production comment\./);
  await ui.click(button(ui, 'Close Issue details'));
  await ui.until(() => reader(ui)?.textContent.includes('A preserved production comment.'), 'reader reflects the saved document');
});

test('Markdown previews keep relative links inert so a draft cannot be navigated away', async (t) => {
  const ui = await renderBoard(t, { 'issues/01-existing.md': '# 01: Existing\n\nStatus: ready-for-agent\n' }, true);
  await ui.until(() => button(ui, 'Read issues/01-existing.md'), 'collection');
  await ui.click(button(ui, 'Read issues/01-existing.md'));
  await ui.until(() => button(ui, 'Issue tools'), 'issue capability');
  await ui.click(button(ui, 'Issue tools'));
  await ui.until(() => field(ui, 'Markdown body'), 'issue editor');
  await ui.change(field(ui, 'Markdown body'), 'See [the spec](../spec.md) and [site](https://example.com).');
  await ui.click(button(ui, 'Preview'));
  const preview = ui.document.querySelector('[aria-label="Body preview"]');
  assert.equal(preview.querySelectorAll('a[href="../spec.md"]').length, 0);
  assert.equal(preview.querySelector('span[title="Document links open from the saved Markdown."]').textContent, 'the spec');
  assert.equal(preview.querySelector('a[href="https://example.com"]').getAttribute('target'), '_blank');
});

test('React Flow keeps measured A/B/C cards visible and stationary while C is hovered with A selected, including live refresh', async (t) => {
  const ui = await renderBoard(t, {
    'A.md': '# A\n\n[B](B.md)', 'B.md': '# B', 'C.md': '# C\n\n[B](B.md)',
  }, true, { live: true, mapGeometry: true, address: 'http://localhost/?view=map&file=A.md' });
  await ui.until(() => ui.document.querySelectorAll('.react-flow__node-document').length === 3, 'measured canvas');
  const node = (path) => ui.document.querySelector(`.react-flow__node[data-id="${path}"]`);
  const selectedPath = () => new URL(ui.document.defaultView.location.href).searchParams.get('file');
  await ui.until(() => node('C.md').style.visibility !== 'hidden', 'initial node measurement');
  const hover = async (type) => act(async () => node('C.md').dispatchEvent(new ui.document.defaultView.MouseEvent(type, { bubbles: true, clientX: 100, clientY: 100 })));
  const positions = () => ['A.md', 'B.md', 'C.md'].map((path) => node(path).style.transform);
  const before = positions();
  const count = ui.measurements.length;
  await hover('mouseover');
  assert.equal(node('C.md').style.visibility, 'visible', 'hover does not discard measured geometry and hide C');
  assert.deepEqual(positions(), before, 'hover does not move any card');
  assert.equal(selectedPath(), 'A.md');
  assert.match(ui.document.querySelector('.react-flow__edge').getAttribute('aria-label'), /B.md and C.md/);
  await writeFile(join(ui.folder, 'A.md'), '# A\n\n[B](B.md)\n\nLive refresh.');
  await ui.until(() => reader(ui)?.textContent.includes('Live refresh.'), 'refresh while hovered');
  assert.equal(node('C.md').style.visibility, 'visible');
  assert.deepEqual(positions(), before);
  assert.equal(selectedPath(), 'A.md');
  assert.equal(ui.measurements.length, count, 'controlled updates do not re-observe measured cards');
  await hover('mouseout');
  assert.equal(node('C.md').style.visibility, 'visible');
  await ui.click(button(ui, 'All connections'));
  assert.equal(ui.document.querySelectorAll('.react-flow__edge').length, 2);
  await ui.click(button(ui, 'Directed'));
  await ui.until(() => node('A.md')?.style.visibility !== 'hidden', 'directed layout');
  await ui.click(button(ui, 'Folders'));
  assert.equal(ui.document.querySelectorAll('.react-flow__node-document').length, 3);
  await ui.click(button(ui, 'Show neighborhood'));
  assert.deepEqual([...ui.document.querySelectorAll('.react-flow__node-document')].map((node) => node.dataset.id).sort(), ['A.md', 'B.md']);
});

test('local maps retain reciprocal direction, separate incoming/outgoing/two-way branches and omit neighbor-to-neighbor chains', async (t) => {
  const ui = await renderBoard(t, {
    'A.md': '# A\n\nNeeds: D.md\n\n[B](B.md)\n[D](D.md)',
    'B.md': '# B\n\n[A](A.md)\n[D](D.md)',
    'C.md': '# C\n\n[A](A.md)', 'D.md': '# D', 'alone.md': '# Alone',
  }, true, { mapGeometry: true, address: 'http://localhost/?view=map&file=A.md&map=local&dependency=needs' });
  await ui.until(() => ui.document.querySelectorAll('.react-flow__edge').length === 4, 'central relationship strokes including the distinct dependency');
  const edges = [...ui.document.querySelectorAll('.react-flow__edge')];
  const reciprocal = edges.find((edge) => /A.md and B.md/.test(edge.getAttribute('aria-label')));
  assert.ok(reciprocal.querySelector('[marker-start][marker-end]'), 'two directions survive the combined stroke');
  assert.ok(!edges.some((edge) => /B.md and D.md/.test(edge.getAttribute('aria-label'))), 'branches never suggest a neighbor chain');
  assert.match(ui.document.querySelector('.map-surface').textContent, /Links here.*Links from here.*Both directions/);
  assert.equal(ui.document.querySelector('.react-flow__node[data-id="alone.md"]'), null, 'unlinked files are outside this one-hop view');
  await ui.click(button(ui, 'All files'));
  await ui.click(button(ui, 'All connections'));
  await ui.until(() => ui.document.querySelector('.react-flow__node[data-id="alone.md"]'), 'unlinked global file');
  await ui.click(button(ui, 'Dependencies'));
  assert.equal(ui.document.querySelectorAll('.react-flow__edge').length, 1);
  assert.match(ui.document.querySelector('.react-flow__edge').getAttribute('aria-label'), /dependency/);
});

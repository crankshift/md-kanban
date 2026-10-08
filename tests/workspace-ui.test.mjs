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

test('authored status board separates system/literal groups and keeps scope destinations under filters', async t => {
  const ui = await renderBoard(t, { ...files, 'docs/D.md': '# D\nStatus: No status', 'docs/E.md': '# E\nStatus: Check status', 'docs/lower.md': '# Lower\nStatus: MOONLIGHT', 'sibling/n.md': '# Sibling\nStatus: Sibling only' }, true, { address: 'http://localhost/?view=board&folder=docs' });
  await ui.until(() => ui.document.querySelector('[data-drop-status="value:moonlight"]'), 'status board');
  const columns = () => [...ui.document.querySelectorAll('[data-drop-status]')];
  assert.ok(ui.document.querySelector('[data-drop-status="@none"]'));
  assert.ok(ui.document.querySelector('[data-drop-status="@check"]'));
  assert.ok(ui.document.querySelector('[data-drop-status="value:no status"]'));
  assert.ok(ui.document.querySelector('[data-drop-status="value:check status"]'));
  assert.equal(columns().filter(c => c.dataset.dropStatus === 'value:moonlight').length, 1);
  assert.equal(ui.document.querySelector('[data-drop-status="value:sibling only"]'), null);
  await ui.change(field(ui, 'Search Markdown files'), 'Lower');
  assert.equal(ui.document.querySelectorAll('[data-status-card]').length, 1);
  assert.ok(ui.document.querySelector('[data-drop-status="value:no status"]'), 'filter keeps destination');
  await ui.click(button(ui, 'Add status')); await ui.change(field(ui, 'New status label'), 'Invented destination'); await ui.click(button(ui, 'Add destination'));
  assert.ok(ui.document.querySelector('[data-drop-status="value:invented destination"]'));
  await ui.click(button(ui, 'Files')); await ui.click(button(ui, 'Board'));
  await ui.until(() => ui.document.querySelector('[data-drop-status="value:invented destination"]'), 'session destination survives views');
  await ui.change(field(ui, 'Group by'), 'Folder property');
  assert.ok(ui.document.querySelector('.generic-column'), 'other property boards remain available');
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

test('ordinary document drafts survive refresh and require explicit discard; source saves and comments use disk', async t => {
  const ui = await renderBoard(t, { 'ordinary.md': '# Ordinary\n\nOriginal body.', 'other.md': '# Other' }, true, { live: true });
  await ui.until(() => button(ui, 'Read ordinary.md'), 'collection'); await ui.click(button(ui, 'Read ordinary.md'));
  await ui.until(() => button(ui, 'Edit'), 'generic tools'); await ui.click(button(ui, 'Edit'));
  await ui.until(() => field(ui, 'Markdown source'), 'source editor');
  await ui.change(field(ui, 'Markdown source'), '# Ordinary\n\nProtected draft.');
  await writeFile(join(ui.folder, 'ordinary.md'), '# Ordinary\n\nExternal body.');
  await ui.until(() => /changed on disk/.test(ui.document.body.textContent), 'external refresh');
  assert.match(field(ui, 'Markdown source').value, /Protected draft/);
  let confirmations = 0; ui.document.defaultView.confirm = () => { confirmations++; return false; };
  await ui.click(button(ui, 'Close Edit document')); assert.equal(confirmations, 1); assert.ok(field(ui, 'Markdown source'));
  ui.document.defaultView.confirm = () => true;
  await ui.click(button(ui, 'Reapply mine on latest')); await ui.click(button(ui, 'Save document'));
  await ui.until(() => !field(ui, 'Markdown source'), 'saved editor closes');
  assert.match(await readFile(join(ui.folder, 'ordinary.md'), 'utf8'), /Protected draft/);
  await ui.click(button(ui, 'Add comment')); await ui.until(() => field(ui, 'Comment'), 'comment editor');
  await ui.change(field(ui, 'Comment'), 'Ordinary author comment.'); await ui.click(button(ui, 'Append comment'));
  await ui.until(() => !field(ui, 'Comment'), 'comment saved');
  assert.match(await readFile(join(ui.folder, 'ordinary.md'), 'utf8'), /## Comments\n\nOrdinary author comment/);
});

test('New issue creates an immediate empty folder, retains it after cancellation, and accepts arbitrary status', async t => {
  const ui = await renderBoard(t, { 'note.md': '# Note' }, true);
  await ui.until(() => button(ui, 'New issue'), 'workspace'); await ui.click(button(ui, 'New issue'));
  await ui.until(() => field(ui, 'Issue title'), 'creator'); await ui.change(field(ui, 'Issue title'), 'Production creation');
  // Use the button inside the creator rather than the tree's same-named action.
  await ui.click([...ui.document.querySelectorAll('[role="dialog"] button')].find(node => node.textContent === 'New folder'));
  await ui.until(() => field(ui, 'Folder name'), 'folder form'); await ui.change(field(ui, 'Folder name'), 'empty'); await ui.click(button(ui, 'Create folder'));
  await ui.until(() => button(ui, 'Scope empty'), 'real empty directory');
  assert.deepEqual(await import('node:fs/promises').then(fs => fs.readdir(join(ui.folder, 'empty'))), []);
  ui.document.defaultView.confirm = () => true; await ui.click(button(ui, 'Close New issue'));
  assert.ok(button(ui, 'Scope empty'), 'folder remains after cancellation'); await ui.click(button(ui, 'Scope empty'));
  await ui.click(button(ui, 'New issue')); await ui.until(() => field(ui, 'Issue title'), 'new creator');
  await ui.change(field(ui, 'Issue title'), 'Production creation'); await ui.change(field(ui, 'Issue status'), 'Invented status'); await ui.change(field(ui, 'Issue body'), 'Body.');
  assert.equal(field(ui, 'Issue filename').value, 'production-creation.md'); await ui.click(button(ui, 'Create issue'));
  await ui.until(() => reader(ui)?.textContent.includes('Production creation'), 'created reader');
  assert.equal(await readFile(join(ui.folder, 'empty/production-creation.md'), 'utf8'), '# Production creation\n\nStatus: Invented status\n\nBody.\n');
});

test('hidden scope falls back, explicit hidden links read without collection expansion and refresh live', async t => {
  const ui = await renderBoard(t, { 'tickets/a.md': '# A\nStatus: Local\n\n[Hidden](../node_modules/pkg/n.md)', 'node_modules/pkg/n.md': '# Hidden\nStatus: Vendor', 'notes/n.md': '# Note\nStatus: Sibling' }, true, { live: true, address: 'http://localhost/?folder=tickets&view=board' });
  await ui.until(() => ui.document.querySelector('[data-status-card="tickets/a.md"]'), 'board');
  await ui.click(ui.document.querySelector('[data-status-card="tickets/a.md"]'));
  await ui.until(() => reader(ui)?.querySelector('a'), 'reader link'); await ui.click(reader(ui).querySelector('a'));
  await ui.until(() => reader(ui)?.textContent.includes('Vendor'), 'explicit hidden reader');
  assert.equal(ui.document.querySelector('[data-drop-status="value:vendor"]'), null);
  await writeFile(join(ui.folder, 'node_modules/pkg/n.md'), '# Hidden changed\nStatus: Vendor');
  await ui.until(() => reader(ui)?.textContent.includes('Hidden changed'), 'hidden opened refresh');
  await ui.click(button(ui, 'Hide tickets')); await ui.until(() => new URL(ui.document.defaultView.location.href).searchParams.get('folder') === null, 'ancestor fallback');
  assert.match(reader(ui).textContent, /Hidden changed/);
  await ui.click(button(ui, 'Show node_modules')); await ui.until(() => ui.document.querySelector('[data-drop-status="value:vendor"]'), 'revealed collection');
});

test('Markdown draft preview keeps relative links inert', async t => {
  const ui = await renderBoard(t, { 'note.md': '# Note' }, true);
  await ui.until(() => button(ui, 'Read note.md'), 'collection'); await ui.click(button(ui, 'Read note.md'));
  await ui.until(() => button(ui, 'Edit'), 'tools'); await ui.click(button(ui, 'Edit'));
  await ui.until(() => field(ui, 'Markdown source'), 'source editor'); await ui.change(field(ui, 'Markdown source'), 'See [the spec](spec.md) and [site](https://example.com).');
  await ui.click(button(ui, 'Preview')); const preview = ui.document.querySelector('[aria-label="Document draft preview"]');
  assert.equal(preview.querySelectorAll('a[href="spec.md"]').length, 0);
  assert.equal(preview.querySelector('span[title="Document links open from the saved Markdown."]').textContent, 'the spec');
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

test('production pointer sensor follows the original grab point, cancels safely and moves with captured revisions', async t => {
  const ui = await renderBoard(t, { 'a.md': '# A\nStatus: Alpha\n\nKeep body.', 'b.md': '# B\nStatus: Beta\n' }, true, { address: 'http://localhost/?view=board' });
  await ui.until(() => ui.document.querySelector('[data-status-card="a.md"]'), 'board');
  const win = ui.document.defaultView;
  const original = win.HTMLElement.prototype.getBoundingClientRect;
  win.HTMLElement.prototype.getBoundingClientRect = function() {
    const column = this.closest('[data-drop-status]');
    if (!column) return original.call(this);
    const index = [...ui.document.querySelectorAll('[data-drop-status]')].indexOf(column), card = this.hasAttribute('data-status-card');
    const x = 250 + index * 230 + (card ? 8 : 0), y = card ? 300 : 230, width = card ? 194 : 210, height = card ? 80 : 500;
    return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON() { return this; } };
  };
  const pointer = async (target, type, x, y) => act(async () => {
    const event = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: 'mouse' } });
    target.dispatchEvent(event); await new Promise(resolve => setTimeout(resolve, 30));
  });
  const card = () => ui.document.querySelector('[data-status-card="a.md"]');
  await pointer(card(), 'pointerdown', 280, 320); await pointer(ui.document, 'pointermove', 320, 350); await pointer(ui.document, 'pointermove', 350, 370);
  const overlay = ui.document.querySelector('[data-drag-preview]'); assert.ok(overlay); assert.equal(getComputedStyle(overlay).width, '194px'); assert.equal(getComputedStyle(overlay).height, '80px');
  const first = overlay.parentElement.style.transform;
  assert.equal(getComputedStyle(card()).opacity, '0.3'); assert.equal(ui.document.body.style.cursor, 'grabbing');
  await pointer(ui.document, 'pointermove', 390, 410); assert.notEqual(overlay.parentElement.style.transform, first, 'overlay follows pointer movement');
  await pointer(ui.document, 'pointercancel', 390, 410);
  assert.equal(ui.document.querySelector('[data-drag-preview]'), null); assert.equal(ui.document.body.style.cursor, '');
  assert.equal(await readFile(join(ui.folder, 'a.md'), 'utf8'), '# A\nStatus: Alpha\n\nKeep body.');
  await pointer(card(), 'pointerdown', 280, 320); await pointer(ui.document, 'pointermove', 520, 360); await pointer(ui.document, 'pointermove', 540, 370); await pointer(ui.document, 'pointerup', 540, 370);
  await ui.until(() => ui.document.querySelector('[data-drop-status="value:beta"] [data-status-card="a.md"]'), 'optimistic destination'); await ui.settled();
  assert.equal(await readFile(join(ui.folder, 'a.md'), 'utf8'), '# A\nStatus: Beta\n\nKeep body.');
  await pointer(card(), 'pointerdown', 520, 320); await pointer(ui.document, 'pointermove', 560, 350);
  const external = '# A\nStatus: External author\n\nLatest external content.';
  await writeFile(join(ui.folder, 'a.md'), external);
  await pointer(ui.document, 'pointermove', 760, 380); await pointer(ui.document, 'pointerup', 760, 380);
  await ui.until(() => /changed on disk/.test(ui.document.body.textContent), 'stale pickup rejection');
  assert.equal(await readFile(join(ui.folder, 'a.md'), 'utf8'), external);
  await ui.until(() => ui.document.querySelector('[data-drop-status="value:external author"] [data-status-card="a.md"]'), 'latest author refresh after rollback');
});

test('failed source drafts can reopen and lost comment responses never retry automatically', async t => {
  const ui = await renderBoard(t, { 'note.md': '# Note\n\nOriginal.' }, true);
  await ui.until(() => button(ui, 'Read note.md'), 'collection'); await ui.click(button(ui, 'Read note.md'));
  await ui.until(() => button(ui, 'Edit'), 'tools'); await ui.click(button(ui, 'Edit')); await ui.until(() => field(ui, 'Markdown source'), 'editor');
  await ui.change(field(ui, 'Markdown source'), '# Note\n\nRetained failed source.');
  const nativeFetch = globalThis.fetch; t.after(() => { globalThis.fetch = nativeFetch; });
  globalThis.fetch = async (url, options) => { if (url === '/api/source' && options?.method === 'POST') throw new Error('Disconnected save'); return nativeFetch(url, options); };
  await ui.click(button(ui, 'Save document')); await ui.until(() => /Disconnected save/.test(ui.document.body.textContent), 'failed write');
  assert.match(field(ui, 'Markdown source').value, /Retained failed source/);
  ui.document.defaultView.confirm = () => true; await ui.click(button(ui, 'Close Edit document'));
  globalThis.fetch = nativeFetch; await ui.click(button(ui, 'Recover failed draft'));
  await ui.until(() => field(ui, 'Markdown source')?.value.includes('Retained failed source'), 'recovered submitted source');
  await ui.click(button(ui, 'Save document')); await ui.until(() => !field(ui, 'Markdown source'), 'saved recovery');
  assert.match(await readFile(join(ui.folder, 'note.md'), 'utf8'), /Retained failed source/);
  await ui.click(button(ui, 'Add comment')); await ui.until(() => field(ui, 'Comment'), 'comment form'); await ui.change(field(ui, 'Comment'), 'Exactly once comment.');
  let writes = 0; globalThis.fetch = async (url, options) => { const response = await nativeFetch(url, options); if (url === '/api/comment' && options?.method === 'POST') { writes++; throw new Error('Lost comment response'); } return response; };
  await ui.click(button(ui, 'Append comment')); await ui.until(() => /Lost comment response/.test(ui.document.body.textContent), 'lost response'); await ui.settled();
  assert.equal(writes, 1); assert.equal(field(ui, 'Comment').value, 'Exactly once comment.');
  assert.equal((await readFile(join(ui.folder, 'note.md'), 'utf8')).split('Exactly once comment.').length - 1, 1);
  assert.ok(button(ui, 'Append comment').disabled, 'changed disk revision requires explicit review/reapply');
  await ui.click(button(ui, 'Close Add comment'));
  globalThis.fetch = nativeFetch;
  await ui.click(button(ui, 'Recover failed draft'));
  await ui.until(() => field(ui, 'Comment')?.value === 'Exactly once comment.', 'reopened lost-response draft');
  await ui.click(button(ui, 'Discard mine'));
  assert.equal(field(ui, 'Comment').value, '', 'discard uses latest disk rather than recovered mutation variables');
  assert.equal(button(ui, 'Recover failed draft'), undefined, 'explicit discard clears failed recovery');
  assert.ok(button(ui, 'Append comment').disabled);
});

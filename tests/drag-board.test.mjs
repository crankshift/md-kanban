import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderBoard } from './render-board.mjs';

const path = '.scratch/alpha/issues/01-example.md';
const original = '# 01: Example\n\n**Status:** ready-for-agent  \nUnknown: keep me\n\n## Outcome\n- [ ] Keep this\n\n## Comments\nPrior comment.\n';
const files = { [path]: original };
// jsdom has no layout. Model the public board's five adjacent columns at known coordinates.
function layout(ui) {
  const columns = [...ui.document.querySelectorAll('section[aria-label]')];
  const rect = (element) => {
    const column = element.closest('section[aria-label]');
    const index = columns.indexOf(column);
    const delta = element.hasAttribute('data-dnd-dragging') ? parseFloat(element.style.getPropertyValue('--dnd-translate')) || 0 : 0;
    const x = (index < 0 ? 0 : index * 200) + delta;
    const isColumn = element === column;
    return { x, y: 0, left: x, top: 0, right: x + 180, bottom: isColumn ? 400 : 100, width: 180, height: isColumn ? 400 : 100, toJSON() {} };
  };
  ui.document.defaultView.HTMLElement.prototype.getBoundingClientRect = function() { return rect(this); };
  ui.document.elementFromPoint = (x) => columns[Math.floor(x / 200)] ?? ui.document.body;
  ui.document.elementsFromPoint = (x) => [ui.document.elementFromPoint(x)];
}
const handle = (ui) => ui.document.querySelector('button[aria-label^="Drag #01:"]');
async function key(ui, code, modifiers = {}) {
  await act(async () => {
    ui.document.activeElement.dispatchEvent(new ui.document.defaultView.KeyboardEvent('keydown', { key: code === 'Space' ? ' ' : code, code, bubbles: true, ...modifiers }));
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
}

test('keyboard pickup and cancellation announce the issue and leave Markdown untouched', async (t) => {
  const ui = await renderBoard(t, files, true);
  layout(ui);
  assert.ok(handle(ui), 'a dedicated keyboard drag handle is available');
  handle(ui).focus();
  await key(ui, 'Space');
  assert.match(ui.document.body.textContent, /(?:Picked up #01: Example|#01: Example over ready-for-agent)/);
  await key(ui, 'Escape');
  assert.match(ui.document.body.textContent, /cancelled/);
  assert.equal(await readFile(join(ui.folder, path), 'utf8'), original);
});


test('keyboard drop moves optimistically, preserves Markdown, sorting and focus, and announces persistence', async (t) => {
  const ui = await renderBoard(t, { ...files, '.scratch/alpha/issues/02-second.md': '# 02: Second\nStatus: ready-for-human\n' }, true);
  layout(ui);
  handle(ui).focus();
  await key(ui, 'Space');
  for (let i = 0; i < 4; i++) await key(ui, 'ArrowRight', { shiftKey: true });
  await key(ui, 'Space');
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, path), 'utf8'), original.replace('ready-for-agent', 'ready-for-human'));
  assert.equal(handle(ui).closest('section').getAttribute('aria-label'), 'ready-for-human');
  assert.equal(ui.document.activeElement, handle(ui));
  assert.match(ui.document.body.textContent, /status saved as ready-for-human/);
  assert.deepEqual([...ui.document.querySelector('section[aria-label="ready-for-human"]').querySelectorAll('article')].map((node) => node.getAttribute('aria-label')), ['Issue #01: Example', 'Issue #02: Second']);
});


test('own-column and outside drops write nothing; List retains the status menu', async (t) => {
  const ui = await renderBoard(t, files, true);
  layout(ui);
  const transport = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = (url, options) => { if (url === '/api/status') writes++; return transport(url, options); };
  t.after(() => { globalThis.fetch = transport; });
  handle(ui).focus();
  await key(ui, 'Enter');
  await key(ui, 'Enter');
  handle(ui).focus();
  await key(ui, 'Space');
  for (let i = 0; i < 12; i++) await key(ui, 'ArrowRight', { shiftKey: true });
  await key(ui, 'Space');
  handle(ui).focus();
  await key(ui, 'Space');
  await key(ui, 'Escape');
  assert.equal(writes, 0);
  assert.equal(await readFile(join(ui.folder, path), 'utf8'), original);
  await ui.click([...ui.document.querySelectorAll('button')].find((node) => node.textContent === 'List'));
  assert.equal(handle(ui), null);
  assert.ok(ui.document.querySelector('button[aria-label^="Status for #01:"]'));
});

test('a pending drop is immediate, disables dragging, and rolls back with an announced failure', async (t) => {
  const ui = await renderBoard(t, files, true);
  layout(ui);
  const transport = globalThis.fetch;
  let reject;
  const gate = new Promise((_, no) => { reject = no; });
  globalThis.fetch = (url, options) => url === '/api/status' ? gate : transport(url, options);
  t.after(() => { globalThis.fetch = transport; });
  handle(ui).focus();
  await key(ui, 'Space');
  for (let i = 0; i < 4; i++) await key(ui, 'ArrowLeft', { shiftKey: true });
  await key(ui, 'Space');
  assert.equal(handle(ui).closest('section').getAttribute('aria-label'), 'needs-info');
  assert.equal(handle(ui).disabled, true);
  assert.equal(await readFile(join(ui.folder, path), 'utf8'), original);
  await act(async () => reject(new Error('Offline write')));
  await ui.settled();
  assert.equal(handle(ui).closest('section').getAttribute('aria-label'), 'ready-for-agent');
  assert.match([...ui.document.querySelectorAll('[role="alert"]')].map((node) => node.textContent).join(' '), /Status was not saved.*Offline write/);
  assert.equal(ui.document.activeElement, handle(ui));
});

test('an external edit during dragging rejects the captured revision and preserves agent content', async (t) => {
  const ui = await renderBoard(t, files, true, { live: true });
  await ui.until(() => ui.document.body.textContent.includes('live'), 'live connection');
  layout(ui);
  handle(ui).focus();
  await key(ui, 'Space');
  const changed = original + '\nAgent addition.\n';
  await writeFile(join(ui.folder, path), changed);
  await ui.until(() => !ui.document.querySelector('[aria-busy="true"]'), 'refresh settles');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 500)));
  for (let i = 0; i < 4; i++) await key(ui, 'ArrowRight', { shiftKey: true });
  await key(ui, 'Space');
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, path), 'utf8'), changed);
  assert.equal(handle(ui).closest('section').getAttribute('aria-label'), 'ready-for-agent');
  assert.match(ui.document.body.textContent, /Status was not saved/);
});


test('wayfinding columns use their own workflow and advisory blockers do not prevent dragging', async (t) => {
  const ui = await renderBoard(t, { [path]: '# 01: Investigate\nType: research\nStatus: open\nBlocked by: 99\n' }, true, { address: 'http://localhost/?workflow=wayfinding' });
  layout(ui);
  handle(ui).focus();
  await key(ui, 'Space');
  for (let i = 0; i < 8; i++) await key(ui, 'ArrowRight', { shiftKey: true });
  await key(ui, 'Space');
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, path), 'utf8'), '# 01: Investigate\nType: research\nStatus: resolved\nBlocked by: 99\n');
  assert.equal(handle(ui).closest('section').getAttribute('aria-label'), 'resolved');
});

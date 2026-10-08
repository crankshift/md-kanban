import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { act } from 'react';
import { renderBoard } from './render-board.mjs';

const path = '.scratch/alpha/issues/01-first.md';
const files = {
  [path]: '# 01: First\n\nStatus: ready-for-agent\n\nOriginal body.\n',
  '.scratch/alpha/issues/02-other.md': '# 02: Other\n\nStatus: needs-info\n',
  '.scratch/alpha/spec.md': '# Specification\n\nOriginal spec.\n',
};
const button = (ui, label) => [...ui.document.querySelectorAll('button')].find((node) => (node.getAttribute('aria-label') ?? node.textContent) === label);
const field = (ui, label) => ui.document.querySelector(`[aria-label="${label}"]`);
const card = (ui) => ui.document.querySelector(`article[aria-label^="Open #"][aria-label$=" · ${path}"]`).closest('article[role="button"]');

test('a shared URL restores navigation and browser Back closes and returns through followed links', async (t) => {
  const params = new URLSearchParams({ workflow: 'implementation', query: 'first', location: '.scratch', feature: JSON.stringify(['.scratch', 'alpha']), issue: path });
  const ui = await renderBoard(t, files, true, { address: `http://localhost/board?${params}` });
  assert.equal(field(ui, 'Issue title').value, 'First');
  assert.equal(ui.document.querySelector('input[type="search"]').value, 'first');
  assert.equal(ui.document.querySelectorAll('article[role="button"]').length, 1);
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  assert.equal(field(ui, 'Issue title'), null);
  await ui.click(card(ui));
  await act(async () => { ui.document.defaultView.history.back(); await new Promise((resolve) => setTimeout(resolve, 150)); });
  assert.equal(field(ui, 'Issue title'), null);
});

test('browser Back asks before discarding an open draft and cancellation preserves its form', async (t) => {
  const ui = await renderBoard(t, files, true);
  await ui.click(card(ui));
  await ui.until(() => field(ui, 'Issue title'), 'issue editor');
  await ui.change(field(ui, 'Issue title'), 'My draft');
  let confirmations = 0;
  ui.document.defaultView.confirm = () => { confirmations++; return false; };
  await act(async () => { ui.document.defaultView.history.back(); await new Promise((resolve) => setTimeout(resolve, 150)); });
  assert.equal(confirmations, 1);
  assert.equal(field(ui, 'Issue title').value, 'My draft');
  ui.document.defaultView.confirm = () => true;
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  await ui.click(card(ui));
  assert.equal(field(ui, 'Issue title').value, 'First');
  assert.equal(ui.document.querySelector('[aria-label="Retained drafts"]'), null);
});

test('a pending status appears immediately then rolls back on failure', async (t) => {
  const ui = await renderBoard(t, files, true);
  const transport = globalThis.fetch;
  let reject;
  const gate = new Promise((_, no) => { reject = no; });
  globalThis.fetch = (url, options) => url === '/api/status' ? gate : transport(url, options);
  t.after(() => { globalThis.fetch = transport; });
  await ui.click(card(ui));
  await ui.until(() => ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]'), 'issue editor');
  await ui.change(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]'), 'wontfix');
  assert.equal(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]').value, 'wontfix');
  assert.match(await readFile(join(ui.folder, path), 'utf8'), /ready-for-agent/);
  await act(async () => reject(new Error('Offline write')));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]').value, 'ready-for-agent');
  assert.match(ui.document.body.textContent, /Status was not saved.*Offline write/);
});

test('a failed save after closing offers to reopen the submitted values', async (t) => {
  const ui = await renderBoard(t, files, true);
  await ui.click(card(ui));
  await ui.until(() => field(ui, 'Issue title'), 'issue editor');
  await ui.change(field(ui, 'Issue title'), 'Submitted title');
  const transport = globalThis.fetch;
  let reject;
  const gate = new Promise((_, no) => { reject = no; });
  globalThis.fetch = (url, options) => url === '/api/edit' ? gate : transport(url, options);
  t.after(() => { globalThis.fetch = transport; });
  await ui.click(button(ui, 'Save issue'));
  assert.equal(card(ui).querySelector('h3').textContent, 'Submitted title');
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  assert.equal(field(ui, 'Issue title'), null);
  await act(async () => reject(new Error('Save offline')));
  await ui.settled();
  await ui.click(card(ui));
  await ui.change(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]'), 'needs-info');
  await ui.settled();
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  await ui.click(button(ui, 'Reopen editor with submitted changes'));
  assert.equal(field(ui, 'Issue title').value, 'Submitted title');
  assert.match(await readFile(join(ui.folder, path), 'utf8'), /# 01: First/);
});

test('creation is optimistic without a number until confirmed and failure removes the placeholder', async (t) => {
  const ui = await renderBoard(t, files, true);
  await ui.click(button(ui, 'New issue'));
  await ui.settled();
  await ui.until(() => field(ui, 'New issue title'), 'issue creator');
  await ui.change(field(ui, 'New issue title'), 'New item');
  const transport = globalThis.fetch;
  let reject;
  const gate = new Promise((_, no) => { reject = no; });
  globalThis.fetch = (url, options) => url === '/api/create' ? gate : transport(url, options);
  t.after(() => { globalThis.fetch = transport; });
  await ui.click(button(ui, 'Create issue'));
  const pending = ui.document.querySelector('article[aria-label^="Creating:"]').closest('article[role="button"]');
  assert.equal(pending.querySelector('[aria-label="Issue number"]').textContent, 'Creating…');
  assert.equal(ui.document.getElementById('drag-creating').getAttribute('data-drag-disabled') === 'true', true, 'unconfirmed creation cannot be dragged');
  assert.ok([...ui.document.querySelectorAll('article[id^="drag-"]')].every((node) => node.getAttribute('data-drag-disabled') === 'true'), 'all cards pause during creation');
  assert.doesNotMatch(pending.querySelector('[aria-label="Issue number"]').textContent, /#/);
  await act(async () => reject(new Error('Creation offline')));
  await ui.settled();
  assert.equal(ui.document.querySelector('article[aria-label^="Creating:"]'), null);
  assert.equal(field(ui, 'New issue title').value, 'New item');
});

test('overlapping fields require extra confirmation before reapplying and documents refresh live', async (t) => {
  const ui = await renderBoard(t, files, true, { live: true });
  await ui.click(card(ui));
  await ui.until(() => field(ui, 'Issue title'), 'issue editor');
  await ui.change(field(ui, 'Issue title'), 'My title');
  await writeFile(join(ui.folder, path), files[path].replace('First', 'Disk title'));
  await ui.until(() => /Changed on disk: title/.test(ui.document.body.textContent), 'field conflict');
  assert.match(ui.document.body.textContent, /Changed in draft: title/);
  let confirmations = 0;
  ui.document.defaultView.confirm = () => { confirmations++; return false; };
  await ui.click(button(ui, 'Reapply mine on latest'));
  assert.equal(confirmations, 1);
  await ui.click(button(ui, 'Save issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, path), 'utf8'), /Disk title/);
  ui.document.defaultView.confirm = () => true;
  await ui.click(button(ui, 'Discard mine'));
  await ui.click(button(ui, 'Specification'));
  await ui.until(() => ui.document.querySelector('[aria-label="Document Markdown"]'), 'open specification');
  await writeFile(join(ui.folder, '.scratch/alpha/spec.md'), '# Specification\n\nFresh spec.\n');
  await ui.until(() => /Fresh spec/.test(ui.document.body.textContent), 'live document refresh');
});

test('the production App keeps an open draft through board and context refetch failures', async (t) => {
  const ui = await renderBoard(t, files, true, { application: true });
  await ui.until(() => button(ui, `Read ${path}`), 'application collection');
  await ui.click(button(ui, `Read ${path}`));
  await ui.until(() => button(ui, 'Issue tools'), 'issue capability');
  await ui.click(button(ui, 'Issue tools'));
  await ui.until(() => field(ui, 'Issue title'), 'issue editor');
  await ui.change(field(ui, 'Issue title'), 'Protected draft');
  const title = field(ui, 'Issue title');
  const transport = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url === '/api/issues' || url === '/api/context') throw new Error('Disconnected read');
    return transport(url, options);
  };
  t.after(() => { globalThis.fetch = transport; });
  await act(async () => { ui.document.defaultView.dispatchEvent(new ui.document.defaultView.Event('focus')); });
  await ui.until(() => /outdated/.test(ui.document.body.textContent), 'board refresh failure');
  assert.equal(field(ui, 'Issue title'), title, 'the production entry point leaves the form mounted');
  assert.equal(title.value, 'Protected draft');
  assert.match(ui.document.body.textContent, /outdated/);
  globalThis.fetch = transport;
  await ui.click(button(ui, 'Reload issues, keep draft'));
  await ui.settled();
  assert.equal(title.value, 'Protected draft');
});

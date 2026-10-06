import { act } from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderBoard } from './render-board.mjs';
const button = (ui, label) => [...ui.document.querySelectorAll('button')].find((node) => node.textContent === label || node.getAttribute('aria-label') === label);
test('candidate fix picker makes no write until Apply and joins the server-confirmed board', async (t) => {
  const original = '# 01: Candidate\nStatus: mystery\n\nKeep.\n';
  const ui = await renderBoard(t, { '01-candidate.md': original }, true);
  await ui.click(button(ui, 'Needs attention'));
  await ui.click(button(ui, 'Candidate'));
  const picker = ui.document.querySelector('[aria-label="Set status"]');
  assert.ok(picker);
  assert.deepEqual(await ui.options(picker), ['needs-triage · Implementation', 'needs-info · Implementation', 'ready-for-agent · Implementation', 'ready-for-human · Implementation', 'wontfix · Implementation', 'open · Wayfinding', 'claimed · Wayfinding', 'resolved · Wayfinding']);
  await ui.change(picker, 'open · Wayfinding');
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), original);
  await ui.click(button(ui, 'Apply fixes'));
  await ui.until(() => ui.document.body.textContent.includes('is on the wayfinding board'), 'board confirmation');
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), original.replace('mystery', 'open'));
});

test('Remove Type fixes a Type conflict without rewriting the body', async (t) => {
  const original = '# 01: Candidate\nStatus: ready-for-agent\nType: research\n\nKeep.\n';
  const ui = await renderBoard(t, { '01-candidate.md': original }, true);
  await ui.click(button(ui, 'Needs attention'));
  await ui.click(button(ui, 'Candidate'));
  await ui.click(ui.document.querySelector('input[type="checkbox"]'));
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), original);
  await ui.click(button(ui, 'Apply fixes'));
  await ui.until(() => ui.document.body.textContent.includes('is on the implementation board'), 'implementation confirmation');
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), original.replace('Type: research\n', ''));
});

test('Type picker replaces an unknown wayfinding type', async (t) => {
  const original = '# 02: Other\nStatus: open\nType: odd\n\nKeep.\n';
  const ui = await renderBoard(t, { '02-other.md': original }, true);
  await ui.click(button(ui, 'Needs attention'));
  await ui.click(button(ui, 'Other'));
  await ui.change(ui.document.querySelector('[aria-label="Set type"]'), 'task');
  assert.equal(await readFile(join(ui.folder, '02-other.md'), 'utf8'), original);
  await ui.click(button(ui, 'Apply fixes'));
  await ui.until(() => ui.document.body.textContent.includes('is on the wayfinding board'), 'type confirmation');
  assert.equal(await readFile(join(ui.folder, '02-other.md'), 'utf8'), original.replace('odd', 'task'));
});

test('whole-file editor protects drafts on cancel and dialog close, and shows remaining server diagnostics', async (t) => {
  const original = '# 01: Candidate\nStatus: mystery\n';
  const ui = await renderBoard(t, { '01-candidate.md': original }, true);
  await ui.click(button(ui, 'Needs attention'));
  await ui.click(button(ui, 'Candidate'));
  await ui.click(button(ui, 'Edit Markdown'));
  const content = '# 01: Candidate\nStatus: open\nType: odd\n';
  await ui.change(ui.document.querySelector('[aria-label="File Markdown"]'), content);
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), original);
  let confirmations = 0;
  ui.document.defaultView.confirm = () => { confirmations++; return false; };
  await ui.click(button(ui, 'Cancel Markdown editing'));
  assert.equal(confirmations, 1);
  assert.equal(ui.document.querySelector('[aria-label="File Markdown"]').value, content);
  await ui.click(button(ui, 'Close Issue details'));
  assert.equal(confirmations, 2);
  await ui.click(button(ui, 'Preview'));
  assert.ok(ui.document.querySelector('[aria-label="File preview"]').textContent.includes('Type: odd'));
  await ui.click(button(ui, 'Write'));
  await ui.click(button(ui, 'Save file'));
  await ui.until(() => ui.document.body.textContent.includes('still needs attention'), 'remaining diagnostics');
  assert.ok(ui.document.querySelector('[aria-label="Set type"]'));
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), content);
  await ui.click(button(ui, 'Close Issue details'));
  assert.equal(confirmations, 2, 'successful save clears the dirty guard');
});

test('repair preview is optimistic, keeps server diagnostics until confirmation, and rolls back stale failures', async (t) => {
  const original = '# 01: Candidate\nStatus: mystery\n';
  const ui = await renderBoard(t, { '01-candidate.md': original }, true);
  await ui.click(button(ui, 'Needs attention'));
  await ui.click(button(ui, 'Candidate'));
  await ui.change(ui.document.querySelector('[aria-label="Set status"]'), 'open · Wayfinding');
  const transport = globalThis.fetch;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async (url, options) => { if (url === '/api/repair') await gate; return transport(url, options); };
  t.after(() => { globalThis.fetch = transport; });
  const external = original + '\nExternal comment.\n';
  await writeFile(join(ui.folder, '01-candidate.md'), external);
  await ui.click(button(ui, 'Apply fixes'));
  const markdown = ui.document.querySelector('[aria-label="Issue Markdown and comments"]');
  assert.ok(markdown.textContent.includes('Status: open'), 'chosen content is previewed before persistence');
  assert.ok(ui.document.querySelector('[aria-label="Fix issue"]'), 'the client has not declared the file fixed');
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), external);
  await act(async () => { release(); await new Promise((resolve) => setTimeout(resolve, 300)); });
  await ui.until(() => ui.document.body.textContent.includes('changed on disk'), 'stale rejection');
  await ui.until(() => markdown.textContent.includes('External comment.'), 'rollback and refresh');
  assert.ok(ui.document.querySelector('[aria-label="Set status"]').value.includes('open'), 'chosen fix is retained');
  assert.ok(ui.document.body.textContent.includes('Save rejected'));
  assert.equal(await readFile(join(ui.folder, '01-candidate.md'), 'utf8'), external);
});

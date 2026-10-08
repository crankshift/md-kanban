import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('the production App keeps an open draft through board and context refetch failures', async (t) => {
  const ui = await renderBoard(t, files, true);
  await ui.until(() => button(ui, `Read ${path}`), 'application collection');
  await ui.click(button(ui, `Read ${path}`));
  await ui.until(() => button(ui, 'Edit'), 'issue capability');
  await ui.click(button(ui, 'Edit'));
  await ui.until(() => field(ui, 'Markdown source'), 'issue editor');
  await ui.change(field(ui, 'Markdown source'), 'Protected draft');
  const title = field(ui, 'Markdown source');
  const transport = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url.startsWith('/api/documents') || url === '/api/context') throw new Error('Disconnected read');
    return transport(url, options);
  };
  t.after(() => { globalThis.fetch = transport; });
  await act(async () => { ui.document.defaultView.dispatchEvent(new ui.document.defaultView.Event('focus')); });
  await ui.until(() => /outdated/.test(ui.document.body.textContent), 'board refresh failure');
  assert.equal(field(ui, 'Markdown source'), title, 'the production entry point leaves the form mounted');
  assert.equal(title.value, 'Protected draft');
  assert.match(ui.document.body.textContent, /outdated/);
  globalThis.fetch = transport;
  await ui.click(button(ui, 'Reload Markdown files'));
  await ui.settled();
  assert.equal(title.value, 'Protected draft');
});

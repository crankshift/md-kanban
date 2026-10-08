import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { renderBoard } from './render-board.mjs';

const files = {
  '.scratch/alpha/issues/01-example.md':
    '# 01: Example\nStatus: ready-for-agent\n\n## Outcome\nRead [spec](../spec.md).\n',
  '.scratch/alpha/issues/02-next.md': '# 02: Next\nStatus: needs-info\nBlocked by: 01\n',
  '.scratch/alpha/issues/03-attention.md':
    '# 03: Check metadata\nStatus: unknown\n\nOriginal diagnostic document.\n',
  '.scratch/alpha/spec.md': '# Alpha specification\n\nSupporting text.\n',
};
const button = (ui, label) =>
  [...ui.document.querySelectorAll('button')].find(
    (node) => node.getAttribute('aria-label') === label || node.textContent === label,
  );
async function key(ui, value, modifiers = {}) {
  await act(async () => {
    ui.document.activeElement.dispatchEvent(
      new ui.document.defaultView.KeyboardEvent('keydown', {
        key: value,
        bubbles: true,
        ...modifiers,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
}

test('navigator collapses by button and hotkey, keeps rail destinations, and ignores typing brackets', async (t) => {
  const ui = await renderBoard(t, files, true);
  await ui.click(button(ui, 'Collapse sidebar'));
  for (const label of [
    'Expand sidebar',
    'Implementation',
    'Wayfinding',
    'Needs attention',
    'Documents',
    'Jump to…',
    'Toggle color mode',
  ])
    assert.ok(button(ui, label), label);
  await ui.click(button(ui, 'Expand sidebar'));
  ui.document.body.focus();
  await key(ui, '[');
  assert.ok(button(ui, 'Expand sidebar'));
  const search = ui.document.querySelector('[aria-label="Search issues"]');
  search.focus();
  await key(ui, '[');
  assert.ok(button(ui, 'Expand sidebar'), 'typing keeps the sidebar');
  assert.equal(ui.document.querySelector('select'), null);
  await ui.click(button(ui, 'Toggle color mode'));
  assert.ok(ui.document.documentElement.classList.contains('dark'), 'the tooltip preserves colour-mode clicks');
});

test('Board and List share filtering, list selection survives reload, and sections collapse', async (t) => {
  const ui = await renderBoard(t, files, true);
  await ui.change(ui.document.querySelector('[aria-label="Search issues"]'), 'example');
  assert.equal(ui.document.querySelectorAll('article').length, 1);
  await ui.click(button(ui, 'List'));
  assert.equal(ui.document.querySelectorAll('article').length, 1);
  assert.equal(new URL(ui.document.defaultView.location.href).searchParams.get('mode'), 'list');
  const status = button(ui, 'Toggle ready-for-agent');
  await ui.click(status);
  assert.equal(status.getAttribute('aria-expanded'), 'false');
  const address = ui.document.defaultView.location.href;
  await ui.unmount();
  assert.match(address, /mode=list/);
});

test('command palette opens issues and documents with keyboard and attention stays read-only', async (t) => {
  const ui = await renderBoard(t, files, true);
  await key(ui, 'k', { ctrlKey: true });
  const search = ui.document.querySelector('[aria-label="Search issues and documents"]');
  assert.ok(search);
  await ui.change(search, 'Alpha specification');
  search.focus();
  await key(ui, 'Enter');
  await ui.until(
    () => ui.document.querySelector('[aria-label="Document Markdown"]'),
    'document content',
  );
  assert.ok(ui.document.querySelector('[role="dialog"]'));
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), null);
  await ui.click(button(ui, 'Close Supporting document'));
  await ui.click(button(ui, 'Needs attention'));
  await ui.click(button(ui, 'Check metadata'));
  await ui.until(
    () => ui.document.querySelector('[aria-label="Issue details"]')?.textContent.includes('Original diagnostic document'),
    'issue details',
  );
  assert.match(
    ui.document.querySelector('[aria-label="Issue details"]').textContent,
    /Original diagnostic document/,
  );
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), null);
  assert.equal(ui.document.querySelector('select'), null);
});

test('a reloaded list URL restores its view and query', async (t) => {
  const ui = await renderBoard(t, files, true, {
    address: 'http://localhost/?mode=list&query=example',
  });
  assert.equal(button(ui, 'List').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.document.querySelector('[aria-label="Search issues"]').value, 'example');
});

test('successful creation opens saved details without asking to discard the already saved draft', async (t) => {
  const ui = await renderBoard(t, files, true);
  let confirmations = 0;
  ui.document.defaultView.confirm = () => {
    confirmations++;
    return false;
  };
  await ui.click(button(ui, 'New issue'));
  await ui.until(() => ui.document.querySelector('[aria-label="New issue title"]'), 'issue creator');
  await ui.change(ui.document.querySelector('[aria-label="New issue title"]'), 'Saved creation');
  await ui.click(button(ui, 'Create issue'));
  await ui.settled();
  assert.equal(confirmations, 0, 'saving is not a discard navigation');
  assert.equal(ui.document.defaultView.location.search.includes('create=true'), false);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Saved creation');
});

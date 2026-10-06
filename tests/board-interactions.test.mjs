import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { discoverIssues } from '../dist/server/discovery.js';
import { fixture } from './fixtures.mjs';

async function renderBoard(t, files) {
  const folder = await fixture(t, files);
  const data = await discoverIssues(folder);
  const dom = new JSDOM('<div id="root"></div>');
  const globals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const { Board } = await vite.ssrLoadModule('/Board.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    await vite.close();
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await act(async () => root.render(createElement(Board, { data })));
  return {
    folder, document: dom.window.document,
    click: async (element) => { assert.ok(element, 'click target exists'); await act(async () => element.click()); },
    change: async (element, value) => {
      assert.ok(element, 'input exists');
      await act(async () => {
        const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      });
    },
  };
}

test('opens the correct issue by path and renders safe Markdown body and comments without file writes', async (t) => {
  const files = {
    '.scratch/alpha/issues/01-read.md': '# 01: Read alpha\nStatus: ready-for-agent\n\n## Outcome\n**Alpha body**\n\n- [x] Read this\n\n## Comments\nA *comment*.\n\n<script>globalThis.owned = true</script>\n\n<img src=x onerror=alert(1)>\n\n[unsafe](javascript:alert(1))\n',
    '.scratch/beta/issues/01-read.md': '# 01: Read beta\nStatus: ready-for-agent\n\n## Notes\nDistinct beta body.\n',
  };
  const ui = await renderBoard(t, files);
  const buttons = ui.document.querySelectorAll('.card-title');
  await ui.click(buttons[1]);
  let panel = ui.document.querySelector('[aria-label="Issue details"]');
  assert.ok(panel, 'card opens a details side panel');
  assert.match(panel.textContent, /Distinct beta body/);
  assert.match(panel.textContent, /\.scratch\/beta\/issues\/01-read\.md/);
  assert.doesNotMatch(panel.textContent, /Alpha body/);
  await ui.click(buttons[0]);
  panel = ui.document.querySelector('[aria-label="Issue details"]');
  assert.equal(panel.querySelector('strong').textContent, 'Alpha body');
  assert.equal(panel.querySelector('em').textContent, 'comment');
  assert.equal(panel.querySelector('input[type="checkbox"]').disabled, true);
  assert.match(panel.textContent, /ready-for-agent/);
  assert.equal(panel.querySelectorAll('script, img, iframe, [onerror]').length, 0);
  assert.equal(panel.querySelectorAll('a[href^="javascript:"]').length, 0);
  await ui.click(panel.querySelector('[aria-label="Close issue details"]'));
  assert.equal(ui.document.querySelector('[aria-label="Issue details"]'), null);
  for (const [path, content] of Object.entries(files)) assert.equal(await readFile(join(ui.folder, path), 'utf8'), content);
});

test('search and both filters compose, and dependency navigation finds hidden targets without guessing ambiguous ones', async (t) => {
  const ui = await renderBoard(t, {
    '.scratch/alpha/issues/01-prerequisite.md': '# 01: Prerequisite\nStatus: resolved\n\n## Answer\nAlpha decision.\n',
    '.scratch/alpha/issues/02-follow.md': '# 02: Follow up\nStatus: open\nBlocked by: 01: Prerequisite, 03, 99, undecided\n\n## Notes\nsearchable body\n',
    '.scratch/alpha/issues/03-question.md': '# 03: Question\nStatus: open\n',
    '.scratch/alpha/tickets/3-duplicate.md': '# 3: Duplicate\nStatus: claimed\n',
    '.scratch/beta/issues/01-other.md': '# 01: Searchable beta\nStatus: open\n',
    'docs/alpha/issues/01-other.md': '# 01: Searchable docs\nStatus: open\n',
  });
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => button.textContent === 'Wayfinding'));
  const search = ui.document.querySelector('input[type="search"]');
  const [location, feature] = ui.document.querySelectorAll('.filters select');
  const cards = () => ui.document.querySelectorAll('.card-title');
  await ui.change(search, ' SEARCHABLE ');
  assert.equal(cards().length, 3, 'body and title matches span locations');
  await ui.change(location, '.scratch');
  assert.equal(cards().length, 2);
  await ui.change(feature, JSON.stringify(['.scratch', 'alpha']));
  assert.equal(cards().length, 1);
  assert.equal(cards()[0].textContent, 'Follow up');
  await ui.click(cards()[0]);
  let panel = ui.document.querySelector('[aria-label="Issue details"]');
  assert.match(panel.textContent, /Resolved prerequisite · no longer blocks/);
  assert.match(panel.textContent, /Missing issue in this feature\/location/);
  assert.match(panel.textContent, /Ambiguous number/);
  assert.match(panel.textContent, /\.scratch\/alpha\/issues\/03-question\.md/);
  assert.match(panel.textContent, /\.scratch\/alpha\/tickets\/3-duplicate\.md/);
  assert.match(panel.textContent, /Unsupported dependency reference/);
  assert.equal(panel.querySelectorAll('.dependency-list button').length, 1, 'only unambiguous targets can be followed');
  await ui.click(panel.querySelector('.dependency-list button'));
  panel = ui.document.querySelector('[aria-label="Issue details"]');
  assert.match(panel.textContent, /Alpha decision/);
  assert.doesNotMatch(panel.textContent, /Searchable beta|Searchable docs/);
  assert.equal(search.value, ' SEARCHABLE ', 'navigation preserves board filters');
  await act(async () => panel.dispatchEvent(new ui.document.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(ui.document.querySelector('[aria-label="Issue details"]'), null);
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => button.textContent === 'Clear search and filters'));
  assert.equal(cards().length, 6);
  await ui.change(feature, JSON.stringify(['docs', 'alpha']));
  assert.equal(cards().length, 1);
  await ui.change(location, '.scratch');
  assert.equal(feature.value, '', 'changing location resets a feature from another location');
  assert.equal(cards().length, 5);
});

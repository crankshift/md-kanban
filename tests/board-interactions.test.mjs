import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, chmod, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { discoverIssues } from '../dist/server/discovery.js';
import { startServer } from '../dist/server/server.js';
import { fixture } from './fixtures.mjs';

async function renderBoard(t, files, editable = false) {
  const folder = await fixture(t, files);
  const data = await discoverIssues(folder);
  const dom = new JSDOM('<div id="root"></div>');
  const globals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  let sessionToken;
  if (editable) {
    const { server, url } = await startServer(folder);
    t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
    const nativeFetch = globalThis.fetch;
    sessionToken = (await (await nativeFetch(`${url}/api/context`)).json()).sessionToken;
    globals.fetch = (path, options) => nativeFetch(new URL(path, url), options);
  }
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
  await act(async () => root.render(createElement(Board, { data, sessionToken })));
  return {
    folder, document: dom.window.document,
    click: async (element) => { assert.ok(element, 'click target exists'); await act(async () => element.click()); },
    change: async (element, value) => {
      assert.ok(element, 'input exists');
      await act(async () => {
        const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      });
    },
    settled: async () => {
      for (let attempt = 0; attempt < 100 && dom.window.document.querySelector('[aria-busy="true"]'); attempt++) {
        await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
      }
      assert.equal(dom.window.document.querySelector('[aria-busy="true"]'), null, 'status operation finishes');
    },
  };
}

test('explicit form saves preserve comments, preview safely and retain drafts across navigation', async (t) => {
  const original = '# 01: Example\nStatus: ready-for-agent\nBlocked by: None (first issue)\n\n## Acceptance\n- [x] Keep\n\n## Comments\nExisting comment.\n';
  const ui = await renderBoard(t, { 'issues/01-example.md': original, 'issues/02-other.md': '# 02: Other\nStatus: needs-info\n' }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => button.textContent === text);
  await ui.click(ui.document.querySelector('[data-issue-id="issues/01-example.md"]'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Edited example');
  await ui.change(ui.document.querySelector('[aria-label="Markdown body"]'), '## Acceptance\n- [x] Keep\n\n**Preview**\n\n<script>bad()</script>\n\n[bad](javascript:alert(1))');
  await ui.change(ui.document.querySelector('[aria-label="New comment"]'), 'Draft comment');
  assert.equal(await readFile(join(ui.folder, 'issues/01-example.md'), 'utf8'), original, 'editing does not autosave');
  await ui.click(button('Preview body'));
  const preview = ui.document.querySelector('[aria-label="Body preview"]');
  assert.equal(preview.querySelector('strong').textContent, 'Preview');
  assert.equal(preview.querySelectorAll('script, a[href^="javascript:"]').length, 0);
  assert.equal(preview.querySelector('input[type="checkbox"]').disabled, true);
  await ui.click(ui.document.querySelector('[data-issue-id="issues/02-other.md"]'));
  await ui.click(ui.document.querySelector('[data-issue-id="issues/01-example.md"]'));
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Edited example');
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'Draft comment');
  await ui.click(button('Save issue'));
  await ui.settled();
  let content = await readFile(join(ui.folder, 'issues/01-example.md'), 'utf8');
  assert.match(content, /# 01: Edited example/);
  assert.match(content, /Blocked by: None \(first issue\)/);
  assert.match(content, /## Comments\nExisting comment\./);
  assert.doesNotMatch(content, /Draft comment/);
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'Draft comment');
  await ui.click(button('Append comment'));
  await ui.settled();
  content = await readFile(join(ui.folder, 'issues/01-example.md'), 'utf8');
  assert.match(content, /Existing comment\.\n\nDraft comment\n$/);
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, '');
});

test('form validation and stale saves retain drafts, and explicit recovery preserves external changes', async (t) => {
  const original = '# 01: Example\nStatus: ready-for-agent\n\n## Notes\nOriginal body.\n\n## Comments\nFirst.\n';
  const ui = await renderBoard(t, { '01-example.md': original }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => button.textContent === text);
  await ui.click(ui.document.querySelector('.card-title'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), '');
  await ui.click(button('Save issue'));
  assert.match(ui.document.querySelector('[aria-label="Issue editor"]').textContent, /nonempty, single-line title/);
  assert.equal(await readFile(join(ui.folder, '01-example.md'), 'utf8'), original);
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'My draft');
  await ui.change(ui.document.querySelector('[aria-label="New comment"]'), 'My comment');
  const external = original.replace('Original body.', 'External body.').replace('First.', 'First.\nAgent comment.');
  await writeFile(join(ui.folder, '01-example.md'), external);
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, '01-example.md'), 'utf8'), external);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'My draft');
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'My comment');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /draft is retained/);
  await ui.click(button('Recover draft on latest version'));
  assert.match(ui.document.querySelector('[aria-label="Markdown body"]').value, /External body/);
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, '01-example.md'), 'utf8'), external.replace('Example', 'My draft'));
  await ui.click(button('Append comment'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, '01-example.md'), 'utf8'), /Agent comment\.\n\nMy comment\n$/);
  await ui.change(ui.document.querySelector('[aria-label="Markdown body"]'), 'Unsaved body');
  await ui.click(button('Reload issues, keep draft'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Markdown body"]').value, 'Unsaved body');
  const event = new ui.document.defaultView.Event('beforeunload', { cancelable: true });
  ui.document.defaultView.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true, 'leaving a draft warns before unloading');
  await ui.click(button('Discard draft'));
  assert.match(ui.document.querySelector('[aria-label="Markdown body"]').value, /External body/);
});

test('dependency/status form fields save explicitly and attention documents stay readable', async (t) => {
  const ui = await renderBoard(t, {
    '.scratch/alpha/issues/01-example.md': '# 01: Example\nStatus: ready-for-agent\nBlocked by: 99\n\n## Acceptance\n- [x] Keep\n',
    '.scratch/alpha/tickets/02-dependency.md': '# 02: Dependency\nStatus: needs-info\n',
    '.scratch/beta/issues/02-other.md': '# 02: Other\nStatus: needs-info\n',
    '.scratch/alpha/issues/03-attention.md': '# 03: Attention\nStatus: unknown\n\nReadable notes.\n',
  }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => button.textContent === text);
  await ui.click(ui.document.querySelector('[data-issue-id=".scratch/alpha/issues/01-example.md"]'));
  const dependencies = ui.document.querySelector('[aria-label="Issue dependencies"]');
  assert.deepEqual([...dependencies.options].map((option) => option.value), ['.scratch/alpha/tickets/02-dependency.md', '.scratch/alpha/issues/03-attention.md']);
  await ui.change(ui.document.querySelector('[aria-label="Issue status"]'), 'needs-info');
  assert.match(await readFile(join(ui.folder, '.scratch/alpha/issues/01-example.md'), 'utf8'), /Status: ready-for-agent/);
  await ui.click(button('Clear dependencies'));
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, '.scratch/alpha/issues/01-example.md'), 'utf8'), /Status: needs-info\nBlocked by: None/);
  await ui.change(ui.document.querySelector('[aria-label="Issue dependencies"]'), '.scratch/alpha/tickets/02-dependency.md');
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, '.scratch/alpha/issues/01-example.md'), 'utf8'), /Blocked by: 02/);
  await ui.click(button('Read issue details'));
  assert.match(ui.document.querySelector('[aria-label="Issue details"]').textContent, /Readable notes/);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), null);
  assert.equal(button('Save issue'), undefined);
});

test('disk errors and lost comment responses preserve recoverable drafts without duplicating a comment', async (t) => {
  const ui = await renderBoard(t, { '01-example.md': '# 01: Example\nStatus: ready-for-agent\n' }, true);
  const path = join(ui.folder, '01-example.md');
  t.after(() => chmod(path, 0o644).catch(() => {}));
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => button.textContent === text);
  await ui.click(ui.document.querySelector('.card-title'));
  await ui.change(ui.document.querySelector('[aria-label="New comment"]'), 'Keep my comment');
  await chmod(path, 0o444);
  await ui.click(button('Append comment'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'Keep my comment');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /Check folder access.*draft is retained/);
  await chmod(path, 0o644);
  const transport = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    const response = await transport(path, options);
    if (path === '/api/comment') throw new TypeError('Lost response');
    return response;
  };
  await ui.click(button('Append comment'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'Keep my comment');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /Could not confirm.*especially comments/);
  assert.equal((await readFile(path, 'utf8')).match(/Keep my comment/g).length, 1);
  globalThis.fetch = transport;
  await ui.click(button('Append comment'));
  await ui.settled();
  assert.equal((await readFile(path, 'utf8')).match(/Keep my comment/g).length, 1, 'stale retry cannot duplicate a comment');
  await ui.click(button('Discard draft'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Offline draft');
  globalThis.fetch = async () => { throw new TypeError('Server offline'); };
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Offline draft');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /Reload failed.*draft is retained/);
  globalThis.fetch = transport;
  await ui.click(button('Reload issues, keep draft'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Offline draft');
});

test('removed or newly unsupported issues retain a copyable draft and can reload without losing it', async (t) => {
  const original = '# 01: Example\nStatus: ready-for-agent\n';
  const ui = await renderBoard(t, { '01-example.md': original }, true);
  const path = join(ui.folder, '01-example.md');
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => button.textContent === text);
  await ui.click(ui.document.querySelector('.card-title'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Recover me');
  await unlink(path);
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.match(ui.document.querySelector('.draft-list').textContent, /Unavailable issue draft.*Recover me/s);
  await writeFile(path, original.replace('ready-for-agent', 'unknown'));
  await ui.click(button('Reload issues, keep drafts'));
  await ui.settled();
  await ui.click(button('Draft #01: Example'));
  assert.match(ui.document.querySelector('[aria-label="Recoverable draft"]').value, /Recover me/);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), null);
  await writeFile(path, original);
  await ui.click(button('Reload issues, keep draft'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Recover me');
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.equal(await readFile(path, 'utf8'), original.replace('Example', 'Recover me'));
});

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

test('keyboard status changes persist immediately, preserve sorted cards and update details', async (t) => {
  const ui = await renderBoard(t, {
    'issues/10-later.md': '# 10: Later\nStatus: needs-info\n',
    'issues/02-start.md': '# 02: Start\n**Status:** ready-for-agent\nBlocked by: 99\n\n## Comments\nKeep this.\n',
  }, true);
  const title = ui.document.querySelector('[data-issue-id="issues/02-start.md"]');
  await ui.click(title);
  const status = title.closest('.card').querySelector('select');
  assert.ok(status, 'card provides a keyboard-accessible status selector');
  assert.equal(status.options.length, 5, 'only the recognized workflow statuses are offered');
  await ui.change(status, 'needs-info');
  await ui.settled();
  const column = ui.document.querySelector('[aria-labelledby="column-needs-info"]');
  assert.deepEqual([...column.querySelectorAll('.card-title')].map((button) => button.textContent), ['Start', 'Later']);
  assert.equal(await readFile(join(ui.folder, 'issues/02-start.md'), 'utf8'), '# 02: Start\n**Status:** needs-info\nBlocked by: 99\n\n## Comments\nKeep this.\n');
  assert.match(ui.document.querySelector('.issue-context').textContent, /needs-info/);
  assert.match(ui.document.querySelector('[role="status"]').textContent, /saved/);
});

test('dragging across columns persists despite advisory blockers, updates dependency indicators and ignores external drops and same-column ordering', async (t) => {
  const ui = await renderBoard(t, {
    'issues/01-prerequisite.md': '# 01: Prerequisite\nStatus: open\nBlocked by: 99\n',
    'issues/02-next.md': '# 02: Next\nStatus: claimed\nBlocked by: 01\n',
  }, true);
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => button.textContent === 'Wayfinding'));
  const card = () => ui.document.querySelector('[data-issue-id="issues/01-prerequisite.md"]').closest('.card');
  const drop = async (target, from = card()) => {
    const transfer = { effectAllowed: '', dropEffect: '', setData() {} };
    await act(async () => {
      for (const [type, element] of [...(from ? [['dragstart', from]] : []), ['dragover', target], ['drop', target]]) {
        const event = new ui.document.defaultView.Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: transfer });
        element.dispatchEvent(event);
      }
    });
    await ui.settled();
  };
  const original = '# 01: Prerequisite\nStatus: open\nBlocked by: 99\n';
  const resolved = ui.document.querySelector('[aria-labelledby="column-resolved"]');
  await drop(resolved, null);
  assert.equal(await readFile(join(ui.folder, 'issues/01-prerequisite.md'), 'utf8'), original, 'external drag data cannot trigger a write');
  await drop(ui.document.querySelector('[aria-labelledby="column-open"]'));
  assert.equal(await readFile(join(ui.folder, 'issues/01-prerequisite.md'), 'utf8'), original);
  assert.equal(ui.document.querySelector('[role="status"]'), null, 'same-column movement does not save ranks or status');
  assert.match(ui.document.querySelector('[data-issue-id="issues/02-next.md"]').closest('.card').textContent, /1 unresolved blocker/);
  await drop(resolved);
  assert.equal(await readFile(join(ui.folder, 'issues/01-prerequisite.md'), 'utf8'), '# 01: Prerequisite\nStatus: resolved\nBlocked by: 99\n');
  assert.equal(card().closest('.column'), resolved);
  assert.doesNotMatch(ui.document.querySelector('[data-issue-id="issues/02-next.md"]').closest('.card').textContent, /unresolved blocker/);
  assert.equal(card().querySelector('select').options.length, 3);
});

test('stale saves refresh the external status and preserve external comments, while disk failures stay visibly unsaved', async (t) => {
  const ui = await renderBoard(t, { '01-change.md': '# 01: Change\nStatus: open\n\n## Comments\nOriginal.\n' }, true);
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => button.textContent === 'Wayfinding'));
  const control = () => ui.document.querySelector('.card select');
  const external = '# 01: Change\nStatus: claimed\n\n## Comments\nAgent comment.\n';
  await writeFile(join(ui.folder, '01-change.md'), external);
  await ui.change(control(), 'resolved');
  await ui.settled();
  assert.equal(control().value, 'claimed');
  assert.equal(control().closest('.column').getAttribute('aria-labelledby'), 'column-claimed');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /Status was not saved.*changed on disk.*Latest issues loaded/);
  assert.equal(await readFile(join(ui.folder, '01-change.md'), 'utf8'), external);
  await chmod(join(ui.folder, '01-change.md'), 0o444);
  await ui.change(control(), 'resolved');
  await ui.settled();
  assert.equal(control().value, 'claimed');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /Status was not saved.*Check folder access/);
  assert.equal(await readFile(join(ui.folder, '01-change.md'), 'utf8'), external);
  await chmod(join(ui.folder, '01-change.md'), 0o644);
  await ui.change(control(), 'resolved');
  await ui.settled();
  assert.equal(control().value, 'resolved');
  assert.match(await readFile(join(ui.folder, '01-change.md'), 'utf8'), /Agent comment/);
});

test('pending saves show the last persisted status and prevent overlapping UI writes', async (t) => {
  const ui = await renderBoard(t, {
    '01-first.md': '# 01: First\nStatus: ready-for-agent\n',
    '02-second.md': '# 02: Second\nStatus: ready-for-agent\n',
  }, true);
  const transport = globalThis.fetch;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async (path, options) => { if (path === '/api/status') await gate; return transport(path, options); };
  const controls = [...ui.document.querySelectorAll('.card select')];
  await ui.change(controls[0], 'needs-info');
  assert.equal(controls[0].value, 'ready-for-agent');
  assert.ok(controls.every((control) => control.disabled));
  assert.match(ui.document.querySelector('[role="status"]').textContent, /Saving issue/);
  await ui.change(controls[1], 'wontfix');
  await act(async () => release());
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, '01-first.md'), 'utf8'), '# 01: First\nStatus: needs-info\n');
  assert.equal(await readFile(join(ui.folder, '02-second.md'), 'utf8'), '# 02: Second\nStatus: ready-for-agent\n');
});

test('a lost save response recovers the persisted status and a failed refresh gives an actionable outdated-state warning', async (t) => {
  const ui = await renderBoard(t, { '01-change.md': '# 01: Change\nStatus: ready-for-agent\n' }, true);
  const transport = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    const response = await transport(path, options);
    if (path === '/api/status') throw new TypeError('Connection lost after save');
    return response;
  };
  await ui.change(ui.document.querySelector('.card select'), 'needs-info');
  await ui.settled();
  assert.equal(ui.document.querySelector('.card select').value, 'needs-info');
  assert.equal(await readFile(join(ui.folder, '01-change.md'), 'utf8'), '# 01: Change\nStatus: needs-info\n');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /Could not confirm.*Latest issues loaded/);
  globalThis.fetch = async () => { throw new TypeError('Server stopped'); };
  await ui.change(ui.document.querySelector('.card select'), 'wontfix');
  await ui.settled();
  assert.equal(ui.document.querySelector('.card select').value, 'needs-info');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /displayed statuses may be outdated.*Reload the page/);
  assert.equal(await readFile(join(ui.folder, '01-change.md'), 'utf8'), '# 01: Change\nStatus: needs-info\n');
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

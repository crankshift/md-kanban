import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, chmod, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { act } from 'react';
import { renderBoard } from './render-board.mjs';

test('explicit form saves preserve comments, preview safely and confirm discarding drafts on navigation', async (t) => {
  const original = '# 01: Example\nStatus: ready-for-agent\nBlocked by: None (first issue)\n\n## Acceptance\n- [x] Keep\n\n## Comments\nExisting comment.\n';
  const ui = await renderBoard(t, { 'issues/01-example.md': original, 'issues/02-other.md': '# 02: Other\nStatus: needs-info\n' }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"][aria-label$=" · issues/01-example.md"]'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Edited example');
  await ui.change(ui.document.querySelector('[aria-label="Markdown body"]'), '## Acceptance\n- [x] Keep\n\n**Preview**\n\n<script>bad()</script>\n\n[bad](javascript:alert(1))');
  await ui.change(ui.document.querySelector('[aria-label="New comment"]'), 'Draft comment');
  assert.equal(await readFile(join(ui.folder, 'issues/01-example.md'), 'utf8'), original, 'editing does not autosave');
  await ui.click(button('Preview'));
  const preview = ui.document.querySelector('[aria-label="Body preview"]');
  assert.equal(preview.querySelector('strong').textContent, 'Preview');
  assert.equal(preview.querySelectorAll('script, a[href^="javascript:"]').length, 0);
  assert.equal(preview.querySelector('input[type="checkbox"]').disabled, true);
  let confirmations = 0;
  ui.document.defaultView.confirm = () => { confirmations++; return false; };
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"][aria-label$=" · issues/02-other.md"]'));
  assert.equal(confirmations, 1);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Edited example');
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
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"]'));
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
  assert.match(ui.document.body.textContent, /draft is retained/);
  await ui.click(button('Reapply mine on latest'));
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
  await ui.click(button('Discard mine'));
  assert.match(ui.document.querySelector('[aria-label="Markdown body"]').value, /External body/);
});

test('dependency/status form fields save explicitly and attention documents stay readable', async (t) => {
  const ui = await renderBoard(t, {
    '.scratch/alpha/issues/01-example.md': '# 01: Example\nStatus: ready-for-agent\nBlocked by: 99\n\n## Acceptance\n- [x] Keep\n',
    '.scratch/alpha/tickets/02-dependency.md': '# 02: Dependency\nStatus: needs-info\n',
    '.scratch/beta/issues/02-other.md': '# 02: Other\nStatus: needs-info\n',
    '.scratch/alpha/issues/03-attention.md': '# 03: Attention\nStatus: unknown\n\nReadable notes.\n',
  }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"][aria-label$=" · .scratch/alpha/issues/01-example.md"]'));
  const dependencies = ui.document.querySelector('[aria-label="Issue dependencies"]');
  assert.deepEqual(await ui.options(dependencies), ['#02: Dependency · .scratch/alpha/tickets', '#03: Attention · .scratch/alpha/issues']);
  await ui.change(ui.document.querySelector('[aria-label="Issue status"]'), 'needs-info');
  assert.match(await readFile(join(ui.folder, '.scratch/alpha/issues/01-example.md'), 'utf8'), /Status: ready-for-agent/);
  await ui.click(button('Clear dependencies'));
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, '.scratch/alpha/issues/01-example.md'), 'utf8'), /Status: needs-info\nBlocked by: None/);
  await ui.change(ui.document.querySelector('[aria-label="Issue dependencies"]'), '#02: Dependency · .scratch/alpha/tickets');
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, '.scratch/alpha/issues/01-example.md'), 'utf8'), /Blocked by: 02/);
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  await ui.click(button('Needs attention'));
  await ui.click(button('Attention'));
  assert.match(ui.document.querySelector('[aria-label="Issue details"]').textContent, /Readable notes/);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), null);
  assert.equal(button('Save issue'), undefined);
});

test('disk errors and lost comment responses preserve recoverable drafts without duplicating a comment', async (t) => {
  const ui = await renderBoard(t, { '01-example.md': '# 01: Example\nStatus: ready-for-agent\n' }, true);
  const path = join(ui.folder, '01-example.md');
  t.after(() => chmod(path, 0o644).catch(() => {}));
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"]'));
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
  await ui.click(button('Discard mine'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Offline draft');
  globalThis.fetch = async () => { throw new TypeError('Server offline'); };
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Offline draft');
  assert.match(ui.document.body.textContent, /draft is retained/);
  globalThis.fetch = transport;
  await ui.click(button('Reload issues, keep draft'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Offline draft');
});

test('removed or newly unsupported issues retain a copyable draft and can reload without losing it', async (t) => {
  const original = '# 01: Example\nStatus: ready-for-agent\n';
  const ui = await renderBoard(t, { '01-example.md': original }, true);
  const path = join(ui.folder, '01-example.md');
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"]'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Recover me');
  await unlink(path);
  await ui.click(button('Save issue'));
  await ui.settled();
  assert.match(ui.document.querySelector('[aria-label="Recoverable draft"]').value, /Recover me/);
  assert.equal(ui.document.querySelector('[aria-label="Retained drafts"]'), null);
  await writeFile(path, original.replace('ready-for-agent', 'unknown'));
  await ui.click(button('Reload issues, keep draft'));
  await ui.settled();
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
  const buttons = ui.document.querySelectorAll('article[aria-label^="Open #"]');
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
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  assert.equal(ui.document.querySelector('[aria-label="Issue details"]'), null);
  for (const [path, content] of Object.entries(files)) assert.equal(await readFile(join(ui.folder, path), 'utf8'), content);
});

test('keyboard status changes persist immediately, preserve sorted cards and update details', async (t) => {
  const ui = await renderBoard(t, {
    'issues/10-later.md': '# 10: Later\nStatus: needs-info\n',
    'issues/02-start.md': '# 02: Start\n**Status:** ready-for-agent\nBlocked by: 99\n\n## Comments\nKeep this.\n',
  }, true);
  const title = ui.document.querySelector('article[aria-label^="Open #"][aria-label$=" · issues/02-start.md"]');
  await ui.click(title);
  const status = ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]');
  assert.ok(status, 'card provides a keyboard-accessible status selector');
  assert.equal((await ui.options(status)).length, 5, 'only the recognized workflow statuses are offered');
  await ui.change(status, 'needs-info');
  await ui.settled();
  const column = ui.document.querySelector('[aria-label="needs-info"]');
  assert.deepEqual([...column.querySelectorAll('article[aria-label^="Open #"]')].map((card) => card.querySelector('h3').textContent), ['Start', 'Later']);
  assert.equal(await readFile(join(ui.folder, 'issues/02-start.md'), 'utf8'), '# 02: Start\n**Status:** needs-info\nBlocked by: 99\n\n## Comments\nKeep this.\n');
  assert.match(ui.document.querySelector('[aria-label="Issue metadata"]').textContent, /needs-info/);
  assert.match(ui.document.body.textContent, /Issue saved/);
});

test('status choices persist despite advisory blockers and update dependency indicators', async (t) => {
  const ui = await renderBoard(t, {
    'issues/01-prerequisite.md': '# 01: Prerequisite\nStatus: open\nBlocked by: 99\n',
    'issues/02-next.md': '# 02: Next\nStatus: claimed\nBlocked by: 01\n',
  }, true);
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === 'Wayfinding'));
  const card = () => ui.document.querySelector('[aria-label^="Open #01: Prerequisite ·"]');
  assert.match(ui.document.querySelector('[aria-label^="Open #02: Next ·"]').textContent, /1 unresolved blocker/);
  await ui.click(card());
  const status = () => ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]');
  assert.deepEqual(await ui.options(status()), ['open', 'claimed', 'resolved']);
  await ui.change(status(), 'resolved');
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, 'issues/01-prerequisite.md'), 'utf8'), '# 01: Prerequisite\nStatus: resolved\nBlocked by: 99\n');
  assert.equal(card().closest('section'), ui.document.querySelector('[aria-label="resolved"]'));
  assert.doesNotMatch(ui.document.querySelector('[aria-label^="Open #02: Next ·"]').textContent, /unresolved blocker/);
});

test('stale saves refresh the external status and preserve external comments, while disk failures stay visibly unsaved', async (t) => {
  const ui = await renderBoard(t, { '01-change.md': '# 01: Change\nStatus: open\n\n## Comments\nOriginal.\n' }, true);
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === 'Wayfinding'));
  await ui.click(ui.document.querySelector('article[role="button"]'));
  const control = () => ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]');
  const external = '# 01: Change\nStatus: claimed\n\n## Comments\nAgent comment.\n';
  await writeFile(join(ui.folder, '01-change.md'), external);
  await ui.change(control(), 'resolved');
  await ui.settled();
  assert.equal(control().value, 'claimed');
  assert.equal(ui.document.querySelector('article[role="button"]').closest('section').getAttribute('aria-label'), 'claimed');
  assert.match(ui.document.querySelector('[role="alert"]').textContent, /Status was not saved.*changed on disk/);
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

test('pending saves show an optimistic status and prevent overlapping UI writes', async (t) => {
  const ui = await renderBoard(t, {
    '01-first.md': '# 01: First\nStatus: ready-for-agent\n',
    '02-second.md': '# 02: Second\nStatus: ready-for-agent\n',
  }, true);
  const transport = globalThis.fetch;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async (path, options) => { if (path === '/api/status') await gate; return transport(path, options); };
  await ui.click(ui.document.querySelector('article[aria-label^="Open #01:"]'));
  const status = () => ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]');
  await ui.change(status(), 'needs-info');
  assert.equal(status().value, 'needs-info');
  assert.equal(status().disabled, true);
  assert.ok([...ui.document.querySelectorAll('article[role="button"]')].every((card) => card.getAttribute('data-drag-disabled') === 'true'));
  assert.match(ui.document.body.textContent, /Saving issue/);
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  await ui.click(ui.document.querySelector('article[aria-label^="Open #02:"]'));
  assert.equal(status().disabled, true, 'another issue picker cannot submit while saving');
  await act(async () => release());
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, '01-first.md'), 'utf8'), '# 01: First\nStatus: needs-info\n');
  assert.equal(await readFile(join(ui.folder, '02-second.md'), 'utf8'), '# 02: Second\nStatus: ready-for-agent\n');
});

test('a lost save response recovers the persisted status and a failed refresh gives an actionable outdated-state warning', async (t) => {
  const ui = await renderBoard(t, { '01-change.md': '# 01: Change\nStatus: ready-for-agent\n' }, true);
  await ui.click(ui.document.querySelector('article[role="button"]'));
  const transport = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    const response = await transport(path, options);
    if (path === '/api/status') throw new TypeError('Connection lost after save');
    return response;
  };
  await ui.change(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]'), 'needs-info');
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]').value, 'needs-info');
  assert.equal(await readFile(join(ui.folder, '01-change.md'), 'utf8'), '# 01: Change\nStatus: needs-info\n');
  assert.match(ui.document.body.textContent, /Could not confirm/);
  globalThis.fetch = async () => { throw new TypeError('Server stopped'); };
  await ui.change(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]'), 'wontfix');
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="Issue metadata"] input[role="combobox"]').value, 'needs-info');
  assert.match(ui.document.body.textContent, /Could not confirm/);
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
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === 'Wayfinding'));
  const search = ui.document.querySelector('input[type="search"]');
  const [location, feature] = ui.document.querySelectorAll('[aria-label="Search and filters"] input[role="combobox"]');
  const cards = () => ui.document.querySelectorAll('article[aria-label^="Open #"]');
  await ui.change(search, ' SEARCHABLE ');
  assert.equal(cards().length, 3, 'body and title matches span locations');
  await ui.change(location, '.scratch');
  assert.equal(cards().length, 2);
  await ui.change(feature, 'alpha · .scratch');
  assert.equal(cards().length, 1);
  assert.equal(cards()[0].querySelector('h3').textContent, 'Follow up');
  await ui.click(cards()[0]);
  let panel = ui.document.querySelector('[aria-label="Issue details"]');
  assert.match(panel.textContent, /Resolved prerequisite · no longer blocks/);
  assert.match(panel.textContent, /Missing issue in this feature\/location/);
  assert.match(panel.textContent, /Ambiguous number/);
  assert.match(panel.textContent, /\.scratch\/alpha\/issues\/03-question\.md/);
  assert.match(panel.textContent, /\.scratch\/alpha\/tickets\/3-duplicate\.md/);
  assert.match(panel.textContent, /Unsupported dependency reference/);
  assert.equal(panel.querySelectorAll('[aria-label="Dependencies"] button').length, 1, 'only unambiguous targets can be followed');
  await ui.click(panel.querySelector('[aria-label="Dependencies"] button'));
  panel = ui.document.querySelector('[aria-label="Issue details"]');
  assert.match(panel.textContent, /Alpha decision/);
  assert.doesNotMatch(panel.textContent, /Searchable beta|Searchable docs/);
  assert.equal(search.value, ' SEARCHABLE ', 'navigation preserves board filters');
  await act(async () => panel.dispatchEvent(new ui.document.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(ui.document.querySelector('[aria-label="Issue details"]'), null);
  await ui.click([...ui.document.querySelectorAll('button')].find((button) => button.textContent === 'Clear search and filters'));
  assert.equal(cards().length, 6);
  await ui.change(feature, 'alpha · docs');
  assert.equal(cards().length, 1);
  await ui.change(location, '.scratch');
  assert.equal(feature.value, 'All efforts', 'changing location resets a feature from another location');
  assert.equal(cards().length, 5);
});

test('creation form previews Markdown, discards drafts on confirmed close and opens a searchable persisted issue', async (t) => {
  const ui = await renderBoard(t, { 'issues/01-existing.md': '# 01: Existing\nStatus: ready-for-agent\n' }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(button('New issue'));
  await ui.settled();
  await ui.change(ui.document.querySelector('[aria-label="New issue title"]'), 'Created example');
  await ui.change(ui.document.querySelector('[aria-label="New issue body"]'), '## Outcome\n**Find this phrase**\n<script>bad()</script>');
  await ui.click(button('Preview'));
  assert.equal(ui.document.querySelector('[aria-label="New issue preview"] strong').textContent, 'Find this phrase');
  assert.equal(ui.document.querySelector('[aria-label="New issue preview"] script'), null);
  await ui.click(button('Close creation'));
  await ui.click(button('New issue'));
  assert.equal(ui.document.querySelector('[aria-label="New issue title"]').value, '');
  await ui.change(ui.document.querySelector('[aria-label="New issue title"]'), 'Created example');
  await ui.change(ui.document.querySelector('[aria-label="New issue body"]'), '## Outcome\n**Find this phrase**');
  await ui.click(button('Create issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, 'issues/02-created-example.md'), 'utf8'), /Find this phrase/);
  assert.ok(ui.document.querySelector('article[aria-label^="Open #"][aria-label$=" · issues/02-created-example.md"]'));
  assert.match(ui.document.querySelector('[aria-label="Issue details"]').textContent, /Created example/);
  await ui.change(ui.document.querySelector('input[type="search"]'), 'Find this phrase');
  assert.equal(ui.document.querySelectorAll('article[role="button"]').length, 1);
});

test('creation validation, conflicts, disk failures and lost responses retain content without false success', async (t) => {
  const { readdir } = await import('node:fs/promises');
  const original = '# 01: Existing\nStatus: ready-for-agent\n';
  const ui = await renderBoard(t, { 'issues/01-existing.md': original }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"]'));
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Existing edit draft');
  await ui.click(button('New issue'));
  await ui.settled();
  await ui.click(button('Create issue'));
  assert.match(ui.document.querySelector('[aria-label="Create issue"]').textContent, /Too small|single-line/);
  await ui.change(ui.document.querySelector('[aria-label="New issue title"]'), 'Retained new draft');
  await ui.change(ui.document.querySelector('[aria-label="New issue body"]'), '## Outcome\nKeep my body.');
  const event = new ui.document.defaultView.Event('beforeunload', { cancelable: true });
  ui.document.defaultView.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  await writeFile(join(ui.folder, 'issues/01-existing.md'), original + '\nExternal body.\n');
  await ui.click(button('Create issue'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="New issue title"]').value, 'Retained new draft');
  assert.equal(ui.document.querySelectorAll('article[role="button"]').length, 1);
  assert.match(ui.document.querySelector('[aria-label="Create issue"]').textContent, /changed on disk/);
  await ui.click(button('Reload containers, keep draft'));
  await ui.settled();
  await chmod(join(ui.folder, 'issues'), 0o500);
  t.after(() => chmod(join(ui.folder, 'issues'), 0o700).catch(() => {}));
  await ui.click(button('Create issue'));
  await ui.settled();
  assert.equal(ui.document.querySelector('[aria-label="New issue body"]').value, '## Outcome\nKeep my body.');
  assert.equal(ui.document.querySelectorAll('article[role="button"]').length, 1);
  await chmod(join(ui.folder, 'issues'), 0o700);
  const transport = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    const response = await transport(path, options);
    if (path === '/api/create') throw new Error('Lost response');
    return response;
  };
  await ui.click(button('Create issue'));
  await ui.settled();
  globalThis.fetch = transport;
  assert.equal(ui.document.querySelector('[aria-label="New issue title"]').value, 'Retained new draft');
  assert.match(ui.document.querySelector('[aria-label="Create issue"]').textContent, /review latest Markdown|Lost response/);
  assert.equal(ui.document.querySelectorAll('article[role="button"]').length, 2, 'refresh shows disk without claiming creation success');
  assert.doesNotMatch(ui.document.body.textContent, /Retained new draft created\./);
  await ui.click(button('Create issue'));
  await ui.settled();
  assert.equal((await readdir(join(ui.folder, 'issues'))).filter((name) => name.endsWith('.md')).length, 2, 'stale retry cannot duplicate a lost-response creation');
  await ui.click(button('Close creation'));
  await ui.click(ui.document.querySelector('article[aria-label^="Open #"][aria-label$=" · issues/01-existing.md"]'));
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Existing');
});

test('creation selects wayfinding workflow/type, scoped dependencies and initial status', async (t) => {
  const ui = await renderBoard(t, {
    '.scratch/alpha/issues/01-existing.md': '# 01: Existing\nStatus: ready-for-agent\n',
    'docs/beta/tickets/01-question.md': '# 01: Question\nStatus: open\nType: research\n',
  }, true);
  const button = (text) => [...ui.document.querySelectorAll('button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent) === text);
  await ui.click(button('New issue'));
  await ui.settled();
  await ui.change(ui.document.querySelector('[aria-label="New issue container"]'), 'Effort: beta · docs/beta/tickets');
  assert.deepEqual(await ui.options(ui.document.querySelector('[aria-label="New issue status"]')), ['open', 'claimed', 'resolved']);
  assert.deepEqual(await ui.options(ui.document.querySelector('[aria-label="New issue dependencies"]')), ['#01: Question · docs/beta/tickets']);
  await ui.change(ui.document.querySelector('[aria-label="New issue title"]'), 'Investigate');
  await ui.change(ui.document.querySelector('[aria-label="New issue type"]'), 'prototype');
  await ui.change(ui.document.querySelector('[aria-label="New issue status"]'), 'claimed');
  const dependencies = ui.document.querySelector('[aria-label="New issue dependencies"]');
  await ui.change(dependencies, '#01: Question · docs/beta/tickets');
  await ui.click(button('Create issue'));
  await ui.settled();
  const saved = await readFile(join(ui.folder, 'docs/beta/tickets/02-investigate.md'), 'utf8');
  assert.match(saved, /Status: claimed\nType: prototype\nBlocked by: 01/);
  assert.ok(ui.document.querySelector('[aria-label="wayfinding board"] article[aria-label^="Open #"][aria-label$=" · docs/beta/tickets/02-investigate.md"]'));
});

test('picker inputs open their searchable options in filters, editing and creation', async (t) => {
  const ui = await renderBoard(t, { 'issues/01-example.md': '# 01: Example\nStatus: ready-for-agent\n', 'issues/02-other.md': '# 02: Other\nStatus: needs-info\n' }, true);
  const open = async (input) => {
    await ui.until(() => !input.disabled, 'picker is ready');
    await ui.click(input);
    assert.equal(input.getAttribute('aria-expanded'), 'true');
    const list = ui.document.getElementById(input.getAttribute('aria-controls'));
    assert.ok(list.querySelector('[role="option"]'));
    await act(async () => input.dispatchEvent(new ui.document.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  };
  await open(ui.document.querySelector('[aria-label="Location"]'));
  await ui.click(ui.document.querySelector('article[role="button"]'));
  await open(ui.document.querySelector('[aria-label="Issue status"]'));
  await open(ui.document.querySelector('[aria-label="Issue dependencies"]'));
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  await ui.click([...ui.document.querySelectorAll('button')].find((node) => node.textContent === 'New issue'));
  await open(ui.document.querySelector('[aria-label="New issue container"]'));
  await open(ui.document.querySelector('[aria-label="New issue status"]'));
  await open(ui.document.querySelector('[aria-label="New issue dependencies"]'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { act } from 'react';
import { renderBoard } from './render-board.mjs';

const files = {
  '.scratch/alpha/issues/01-first.md': '# 01: Alpha first\n\nStatus: ready-for-agent\nBlocked by: None\n\n## Notes\nOriginal notes.\n',
  '.scratch/alpha/issues/02-second.md': '# 02: Alpha second\n\nStatus: needs-info\nBlocked by: 01\n',
  '.scratch/beta/issues/01-third.md': '# 01: Beta third\n\nStatus: needs-info\n',
  '.scratch/beta/issues/02-question.md': '# 02: Beta question\n\nStatus: open\nType: research\n',
  '.scratch/alpha/spec.md': '# Spec\n\nStatus: draft\n',
};
const FIRST = '.scratch/alpha/issues/01-first.md';
const SECOND = '.scratch/alpha/issues/02-second.md';

async function liveBoard(t, initial = files) {
  const ui = await renderBoard(t, initial, true, { live: true });
  const text = (selector) => ui.document.querySelector(selector)?.textContent ?? '';
  const button = (label) => [...ui.document.querySelectorAll('button')].find((candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent) === label);
  const column = (status) => ui.document.querySelector(`section[aria-label="${status}"]`);
  const cards = (status) => [...column(status).querySelectorAll('button[aria-label^="Open #"]')].map((card) => card.textContent);
  await ui.until(() => text('[aria-label="Connection: live"]').startsWith('live'), 'the live connection');
  return { ...ui, text, button, column, cards,
    write: (path, content) => writeFile(join(ui.folder, path), content),
    open: (path) => ui.click(ui.document.querySelector(`button[aria-label^="Open #"][aria-label$=" · ${path}"]`)) };
}

test('external edits, creations, renames and deletions refresh untouched issues while search, filters, workflow and other drafts stay put', async (t) => {
  const ui = await liveBoard(t);
  await ui.change(ui.document.querySelector('input[type="search"]'), 'alpha');
  const feature = () => [...ui.document.querySelectorAll('[aria-label="Search and filters"] input[role="combobox"]')][1];
  await ui.change(feature(), 'alpha · .scratch');
  await ui.open(FIRST);
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'My unsaved title');
  assert.deepEqual(ui.cards('needs-info'), ['Alpha second']);

  await ui.write(SECOND, '# 02: Alpha second renamed\n\nStatus: ready-for-human\nBlocked by: 01\n');
  await ui.until(() => ui.cards('ready-for-human').length === 1, 'the edited issue to change columns');
  assert.deepEqual(ui.cards('ready-for-human'), ['Alpha second renamed']);
  assert.equal(ui.document.querySelector('input[type="search"]').value, 'alpha');
  assert.equal(feature().value, 'alpha · .scratch');
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'My unsaved title', 'another issue never resets the draft');
  assert.equal(ui.text('[aria-label="Issue details"] h2'), '#01: Alpha first');
  assert.equal(ui.text('[role="alert"]'), '', 'an unrelated change is not a conflict');

  await ui.write('.scratch/alpha/issues/03-created.md', '# 03: Alpha created\n\nStatus: needs-triage\n');
  await ui.until(() => ui.cards('needs-triage').includes('Alpha created'), 'a created issue');
  await ui.write('.scratch/alpha/spec.md', '# Spec\n\nStatus: approved\n');
  await rename(join(ui.folder, '.scratch/alpha/issues/03-created.md'), join(ui.folder, '.scratch/alpha/issues/03-renamed.md'));
  await ui.until(() => ui.document.querySelector('button[aria-label^="Open #"][aria-label$=" · .scratch/alpha/issues/03-renamed.md"]'), 'a renamed issue');
  assert.equal(ui.document.querySelector('button[aria-label^="Open #"][aria-label$=" · .scratch/alpha/issues/03-created.md"]'), null);
  await rm(join(ui.folder, '.scratch/alpha/issues/03-renamed.md'));
  await ui.until(() => !ui.cards('needs-triage').includes('Alpha created'), 'a deleted issue to leave the board');
  assert.equal(ui.document.querySelector('button[aria-label^="Open #"][aria-label$=" · .scratch/alpha/spec.md"]'), null, 'supporting documents never become cards');
  assert.ok(ui.button('Needs attention'), 'attention remains reachable');
});

test('an untouched open issue follows its file without a conflict', async (t) => {
  const ui = await liveBoard(t);
  await ui.open(FIRST);
  const title = ui.document.querySelector('[aria-label="Issue title"]');
  await ui.write(FIRST, files[FIRST].replace('Alpha first', 'Alpha first, revised').replace('Original notes.', 'Agent notes.'));
  await ui.until(() => ui.text('[aria-label="Issue details"] h2').includes('revised'), 'the details to refresh');
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), title, 'the form is not remounted');
  assert.equal(title.value, 'Alpha first, revised');
  assert.equal(ui.document.querySelector('[aria-label="Markdown body"]').value, '## Notes\nAgent notes.');
  assert.equal(ui.document.querySelector('[aria-label="Retained drafts"]'), null);
  assert.equal(ui.button('Save issue').disabled, true, 'refreshed values are not a draft');
});

test('a dirty draft survives an external change to its issue, stale saves are rejected, and recovery stays explicit', async (t) => {
  const ui = await liveBoard(t);
  await ui.open(FIRST);
  const title = ui.document.querySelector('[aria-label="Issue title"]');
  await ui.change(title, 'Draft title');
  await ui.change(ui.document.querySelector('[aria-label="New comment"]'), 'Draft comment');
  const external = files[FIRST].replace('Original notes.', 'Agent notes.') + '\n## Comments\nAgent comment.\n';
  await ui.write(FIRST, external);
  await ui.until(() => /changed outside the app/.test(ui.text('[aria-label="Issue editor"]')), 'the conflict notice');
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), title, 'typing is not interrupted');
  assert.equal(title.value, 'Draft title');
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'Draft comment');
  assert.match(ui.text('[aria-label="Issue editor"]'), /loaded issue differs from your draft/);
  assert.match(ui.text('[aria-label="Issue Markdown and comments"]'), /Agent notes/);

  await ui.click(ui.button('Save issue'));
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, FIRST), 'utf8'), external, 'the stale save changed nothing');
  assert.equal(title.value, 'Draft title');
  await ui.click(ui.button('Append comment'));
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, FIRST), 'utf8'), external, 'a stale comment is rejected too');
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'Draft comment');

  await ui.click(ui.button('Reapply mine on latest'));
  await ui.click(ui.button('Save issue'));
  await ui.settled();
  const saved = await readFile(join(ui.folder, FIRST), 'utf8');
  assert.match(saved, /^# 01: Draft title\n/);
  assert.match(saved, /Agent comment\./);
  assert.match(saved, /Agent notes\./);
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, 'Draft comment', 'the unsent comment stays a draft');
});

test('app saves are not duplicated or reverted by their own file-change notifications', async (t) => {
  const ui = await liveBoard(t);
  await ui.open(FIRST);
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Saved title');
  await ui.click(ui.button('Save issue'));
  await ui.settled();
  assert.match(ui.document.body.textContent, /Issue saved/);
  await new Promise((resolve) => setTimeout(resolve, 600)); // The server's echo arrives and must change nothing.
  await act(async () => {});
  assert.match(ui.document.body.textContent, /Issue saved/);
  assert.equal(ui.document.querySelector('[aria-label="Retained drafts"]'), null);
  assert.equal(ui.button('Save issue').disabled, true);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Saved title');
  await ui.change(ui.document.querySelector('[aria-label="New comment"]'), 'One comment');
  await ui.click(ui.button('Append comment'));
  await ui.settled();
  await new Promise((resolve) => setTimeout(resolve, 600));
  await act(async () => {});
  assert.equal((await readFile(join(ui.folder, FIRST), 'utf8')).match(/One comment/g).length, 1);
  assert.equal(ui.document.querySelector('[aria-label="New comment"]').value, '');
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  // A status move after an external change uses the refreshed revision rather than a stale one.
  await ui.write(SECOND, files[SECOND].replace('needs-info', 'ready-for-human'));
  await ui.until(() => ui.cards('ready-for-human').length === 1, 'the external status');
  const select = ui.document.querySelector(`button[aria-label^="Open #"][aria-label$=" · ${SECOND}"]`).closest('article[aria-label^="Issue #"]').querySelector('input[role="combobox"]');
  await ui.change(select, 'wontfix');
  await ui.settled();
  assert.match(await readFile(join(ui.folder, SECOND), 'utf8'), /Status: wontfix/);
});

test('a removed issue keeps its draft recoverable while the details stay open', async (t) => {
  const ui = await liveBoard(t);
  await ui.open(FIRST);
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Recover me');
  await rm(join(ui.folder, FIRST));
  await ui.until(() => ui.document.querySelector('[aria-label="Recoverable draft"]'), 'the removed-issue panel');
  assert.match(ui.document.querySelector('[aria-label="Recoverable draft"]').value, /Recover me/);
  assert.match(ui.text('[aria-label="Issue details"]'), /removed, renamed, or moved/s);
  await ui.click(ui.button('Discard mine'));
  assert.equal(ui.document.querySelector('[aria-label="Retained drafts"]'), null);
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  assert.equal(ui.document.querySelector('[aria-label="Issue details"]'), null);

  await ui.open(SECOND);
  await rm(join(ui.folder, SECOND));
  await ui.until(() => /removed, renamed, or moved outside the app/.test(ui.text('[aria-label="Issue details"]')), 'the removed-issue notice');
  assert.equal(ui.document.querySelector('[aria-label="Recoverable draft"]'), null, 'there is no draft to show');
  await ui.write(SECOND, files[SECOND]); // A delete-and-recreate returns the same issue to the open panel.
  await ui.until(() => ui.text('[aria-label="Issue details"] h2') === '#02: Alpha second', 'the reappearing issue');
  await ui.click(ui.document.querySelector('[aria-label="Close Issue details"]'));
  assert.equal(ui.document.querySelector('[aria-label="Issue details"]'), null);
});

test('a draft returns to the reappearing file, which is a conflict rather than a silent rebase', async (t) => {
  const ui = await liveBoard(t);
  await ui.open(FIRST);
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Back again');
  await rm(join(ui.folder, FIRST));
  await ui.until(() => ui.document.querySelector('[aria-label="Recoverable draft"]'), 'removal');
  await ui.write(FIRST, files[FIRST].replace('Original notes.', 'Rewritten.'));
  await ui.until(() => ui.document.querySelector('[aria-label="Issue title"]'), 'the file to return');
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Back again');
  assert.match(ui.text('[aria-label="Issue editor"]'), /loaded issue differs from your draft/);
  await ui.click(ui.button('Save issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, FIRST), 'utf8'), /^# 01: Alpha first\n/, 'the draft was not written over the new file');
});

test('files becoming malformed move to Needs attention while the draft stays recoverable', async (t) => {
  const ui = await liveBoard(t);
  await ui.open(FIRST);
  await ui.change(ui.document.querySelector('[aria-label="Issue title"]'), 'Mid-edit');
  await ui.write(FIRST, '# 01: Alpha first\n\nStatus: finished\n');
  await ui.until(() => !ui.document.querySelector('button[aria-label^="Open #"][aria-label$=" · .scratch/alpha/issues/01-first.md"]'), 'unrecognized issue leaves the board');
  assert.match(ui.document.querySelector('[aria-label="Issue details"]').textContent, /status/i);
  assert.ok(!ui.cards('ready-for-agent').includes('Alpha first'));
  assert.match(ui.text('[aria-label="Issue editor"]'), /needs attention/);
  assert.match(ui.document.querySelector('[aria-label="Recoverable draft"]').value, /Mid-edit/);
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]'), null);
  await ui.write(FIRST, files[FIRST]);
  await ui.until(() => ui.document.querySelector('[aria-label="Issue title"]'), 'the repaired file');
  assert.equal(ui.document.querySelector('[aria-label="Issue title"]').value, 'Mid-edit');
  assert.ok(ui.button('Needs attention'), 'attention remains reachable');
});

test('creation drafts are kept when the folder changes, while an untouched form follows it', async (t) => {
  const ui = await liveBoard(t);
  await ui.click(ui.button('New issue'));
  await ui.until(() => ui.document.querySelector('[aria-label="New issue container"]').value.includes('alpha'), 'creation folders');
  const container = ui.document.querySelector('[aria-label="New issue container"]');
  assert.match(container.value, /alpha/);
  await ui.write('.scratch/alpha/issues/03-agent.md', '# 03: Agent made\n\nStatus: needs-triage\n');
  await ui.until(() => ui.document.querySelector('button[aria-label^="Open #"][aria-label$=" · .scratch/alpha/issues/03-agent.md"]'), 'the agent issue');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  assert.equal(ui.document.querySelector('[aria-label="Create issue"] [role="alert"]'), null, 'an untouched form just refreshes');
  await ui.change(ui.document.querySelector('[aria-label="New issue title"]'), 'Typed title');
  await ui.change(ui.document.querySelector('[aria-label="New issue body"]'), 'Typed body');
  await ui.write('.scratch/alpha/issues/04-agent.md', '# 04: Agent again\n\nStatus: needs-triage\n');
  await ui.until(() => /changed outside the app/.test(ui.text('[aria-label="Create issue"]')), 'the outdated creation notice');
  assert.equal(ui.document.querySelector('[aria-label="New issue title"]').value, 'Typed title');
  assert.equal(ui.document.querySelector('[aria-label="New issue body"]').value, 'Typed body');
  await ui.click(ui.button('Create issue'));
  await ui.settled();
  assert.equal(await readFile(join(ui.folder, '.scratch/alpha/issues/05-typed-title.md'), 'utf8').catch(() => null), null, 'the stale snapshot is rejected');
  assert.equal(ui.document.querySelector('[aria-label="New issue title"]').value, 'Typed title');
  await ui.click(ui.button('Reload containers, keep draft'));
  await ui.until(() => !/changed outside the app/.test(ui.text('[aria-label="Create issue"]')), 'the notice to clear');
  await ui.click(ui.button('Create issue'));
  await ui.settled();
  assert.match(await readFile(join(ui.folder, '.scratch/alpha/issues/05-typed-title.md'), 'utf8'), /^# 05: Typed title\n/);
});

test('losing the connection is reported, and unmounting releases the event stream', async (t) => {
  const ui = await liveBoard(t);
  assert.equal(ui.sources.length, 1);
  await new Promise((resolve) => { ui.server.close(resolve); ui.server.closeAllConnections(); });
  await ui.until(() => ui.document.querySelector('[aria-label="Connection: offline"]'), 'the offline indicator');
  assert.equal(ui.document.querySelector('[aria-label="Connection: live"]'), null);
  await ui.unmount();
  assert.equal(ui.sources[0].closed, true);
});

test('a refresh waits for an in-flight save instead of racing its confirmation', async (t) => {
  const ui = await liveBoard(t);
  const transport = globalThis.fetch;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = (path, options) => String(path).includes('/api/status') ? gate.then(() => transport(path, options)) : transport(path, options);
  t.after(() => { globalThis.fetch = transport; });
  const select = ui.document.querySelector(`button[aria-label^="Open #"][aria-label$=" · ${FIRST}"]`).closest('article[aria-label^="Issue #"]').querySelector('input[role="combobox"]');
  await ui.change(select, 'needs-info');
  assert.match(ui.document.body.textContent, /Saving issue/);
  await ui.write(SECOND, files[SECOND].replace('needs-info', 'wontfix'));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
  assert.ok(!ui.cards('wontfix').includes('Alpha second'), 'the board shows confirmed state while a save is pending');
  assert.ok(ui.cards('needs-info').includes('Alpha first'), 'the pending move is optimistic');
  release();
  await ui.until(() => ui.cards('wontfix').includes('Alpha second'), 'the deferred refresh');
  assert.ok(ui.cards('needs-info').includes('Alpha first'), 'the confirmed save is kept');
  assert.match(await readFile(join(ui.folder, FIRST), 'utf8'), /Status: needs-info/);
});

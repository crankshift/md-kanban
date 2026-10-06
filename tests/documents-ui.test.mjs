import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act } from 'react';
import { renderBoard } from './render-board.mjs';

const files = {
  '.scratch/alpha/issues/01-start.md': '# 01: Start\n\nStatus: ready-for-agent\n\nRead [the spec](../spec.md), [section](../spec.md#open-questions), [next issue](02-next.md), [missing](../gone.md), [escape](../../../../outside.md), [site](https://example.com/page) and [here](#details).\n\n## Details\nText.\n',
  '.scratch/alpha/issues/02-next.md': '# 02: Next\n\nStatus: needs-info\n',
  '.scratch/alpha/spec.md': '# Alpha specification\n\n## Scope\nSee [workflow](implementation-workflow.md), [the ADR](../../docs/adr/0001-proposed.md), [leak](../../docs/leak.md), [absent](#nothing-here) and [start](issues/01-start.md).\n\n## Open questions\nNone.\n\n## Open questions\nDuplicate.\n',
  '.scratch/alpha/implementation-workflow.md': '# Workflow\n\nBack to [spec](spec.md).\n',
  '.scratch/beta/issues/01-question.md': '# 01: Question\n\nStatus: open\nType: research\n',
  '.scratch/beta/map.md': '# Beta map\n',
  'docs/adr/0001-proposed.md': '# 0001: Proposed decision\n\nStatus: proposed\n',
  'docs/guide.md': '# Guide\n',
};
const folderFiles = async (root, directory = '') => {
  const result = {};
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(result, await folderFiles(root, path));
    else if (entry.isFile()) result[path] = [await readFile(join(root, path), 'utf8'), (await stat(join(root, path))).mtimeMs];
  }
  return result;
};
const text = (element) => element?.textContent ?? '';

async function setup(t) {
  const outside = await mkdtemp(join(tmpdir(), 'mdkanban-ui-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'secret.md'), '# Private\n');
  const ui = await renderBoard(t, files, true);
  await symlink(join(outside, 'secret.md'), join(ui.folder, 'docs/leak.md'));
  const scrolled = [];
  ui.document.defaultView.HTMLElement.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(text(this)); };
  const documentPanel = () => ui.document.querySelector('[aria-label="Supporting document"]');
  const issuePanel = () => ui.document.querySelector('[aria-label="Issue details"]');
  const link = (panel, label) => [...panel.querySelectorAll('[aria-label="Issue Markdown and comments"] a, [aria-label="Document Markdown"] a')].find((candidate) => text(candidate) === label);
  const button = (label, scope = ui.document) => [...scope.querySelectorAll('button')].find((candidate) => (candidate.getAttribute('aria-label') ?? text(candidate)) === label);
  await ui.until(() => ui.document.querySelector('section[aria-label="Supporting documents"]'), 'supporting document list');
  return { ...ui, scrolled, documentPanel, issuePanel, link, button };
}

test('the board lists supporting documents separately from cards and renders an ADR read-only', async (t) => {
  const ui = await setup(t);
  const before = await folderFiles(ui.folder);
  const list = ui.document.querySelector('section[aria-label="Supporting documents"]');
  assert.deepEqual([...list.querySelectorAll('[aria-label="Document group"]')].map(text), ['Specifications', 'Wayfinding maps', 'Architectural decisions']);
  assert.deepEqual([...list.querySelectorAll('li button')].map(text), ['Alpha specification', 'Beta map', '0001: Proposed decision']);
  assert.equal(ui.document.querySelectorAll('article[aria-label^="Issue #"]').length, 2, 'only implementation issues are cards');
  assert.ok(ui.button('Needs attention'));
  await ui.click(ui.button('0001: Proposed decision', list));
  await ui.until(() => ui.documentPanel()?.querySelector('[aria-label="Document Markdown"]'), 'ADR content');
  const panel = ui.documentPanel();
  assert.match(text(panel), /Architectural decision · read-only/);
  assert.match(text(panel), /Status: proposed/);
  assert.equal(panel.querySelectorAll('textarea, input, select, form').length, 0, 'no editing controls');
  assert.deepEqual([...panel.querySelectorAll('button')].map(text), ['Reload document']);
  assert.ok(ui.button('Needs attention'));
  assert.deepEqual(await folderFiles(ui.folder), before, 'reading writes nothing');
  await ui.click(ui.document.querySelector('[aria-label="Close Supporting document"]'));
  assert.equal(ui.documentPanel(), null);
});

test('issue and specification links open in-root targets, with Back, fragments and clear unavailable results', async (t) => {
  const ui = await setup(t);
  const before = await folderFiles(ui.folder);
  await ui.click(ui.document.querySelector('button[aria-label^="Open #"][aria-label$=" · .scratch/alpha/issues/01-start.md"]'));
  let panel = ui.issuePanel();
  assert.equal(ui.link(panel, 'site').getAttribute('rel'), 'noopener noreferrer');
  assert.equal(ui.link(panel, 'site').getAttribute('target'), '_blank');
  await ui.click(ui.link(panel, 'here'));
  assert.deepEqual(ui.scrolled, ['Details'], 'same-document fragments scroll to the heading');
  await ui.click(ui.link(panel, 'missing'));
  await ui.until(() => /Unavailable link “..\/gone.md”: .*does not exist/.test(text(ui.issuePanel())), 'missing target report');
  await ui.click(ui.link(panel, 'escape'));
  await ui.until(() => /outside the selected folder, so it was not read/.test(text(ui.issuePanel())), 'out-of-scope report');
  assert.ok(ui.issuePanel(), 'an unavailable link leaves the issue open');
  assert.ok([...ui.document.querySelectorAll('[role="status"]')].some((status) => /Unavailable link/.test(text(status))), 'unavailable links also show a persistent toast');

  await ui.click(ui.link(panel, 'section'));
  await ui.until(() => ui.documentPanel()?.querySelector('[aria-label="Document Markdown"]'), 'specification');
  assert.equal(ui.issuePanel(), null);
  assert.match(text(ui.documentPanel()), /Alpha specification/);
  assert.match(text(ui.documentPanel()), /Specification · read-only/);
  await ui.until(() => ui.scrolled.includes('Open questions'), 'fragment scroll after opening');
  assert.equal(ui.scrolled.length, 2);

  panel = ui.documentPanel();
  await ui.click(ui.link(panel, 'absent'));
  await ui.until(() => /“nothing-here” was not found/.test(text(ui.documentPanel())), 'missing fragment');
  await ui.click(ui.link(panel, 'leak'));
  await ui.until(() => /symbolic links/.test(text(ui.documentPanel())), 'symlink escape report');
  assert.doesNotMatch(text(ui.documentPanel()), /Private/);
  await ui.click(ui.link(panel, 'workflow'));
  await ui.until(() => /Back to \[?spec|Workflow/.test(text(ui.documentPanel())) && text(ui.documentPanel().querySelector('h2')) === 'Workflow', 'ordinary linked document');
  assert.match(text(ui.document.body), /Back to previous document/);
  await ui.click(ui.button('Back to previous document'));
  await ui.until(() => text(ui.documentPanel().querySelector('h2')) === 'Alpha specification', 'back to the specification');
  await ui.click(ui.button('Back to issue'));
  assert.ok(ui.issuePanel(), 'Back returns to the originating issue');
  assert.match(text(ui.issuePanel()), /#01: Start/);

  await ui.click(ui.link(ui.issuePanel(), 'next issue'));
  await ui.until(() => /#02: Next/.test(text(ui.issuePanel())), 'issue link opens the issue panel');
  assert.equal(ui.documentPanel(), null);
  assert.deepEqual(await folderFiles(ui.folder), before, 'following links writes nothing');
});

test('a specification link to an issue opens that issue, and the ADR link reaches the proposed ADR', async (t) => {
  const ui = await setup(t);
  await ui.click(ui.button('Alpha specification', ui.document.querySelector('section[aria-label="Supporting documents"]')));
  await ui.until(() => ui.documentPanel()?.querySelector('[aria-label="Document Markdown"]'), 'specification');
  await ui.click(ui.link(ui.documentPanel(), 'the ADR'));
  await ui.until(() => text(ui.documentPanel().querySelector('h2')) === '0001: Proposed decision', 'ADR from spec');
  await ui.click(ui.button('Back to previous document'));
  await ui.until(() => text(ui.documentPanel().querySelector('h2')) === 'Alpha specification', 'back');
  await ui.click(ui.link(ui.documentPanel(), 'start'));
  await ui.until(() => /#01: Start/.test(text(ui.issuePanel())), 'issue opens from a specification');
});

test('a revisited document shows external edits, and the document list follows new documents', async (t) => {
  const ui = await setup(t);
  const open = async (label) => {
    await ui.click(ui.button(label, ui.document.querySelector('section[aria-label="Supporting documents"]')));
    await ui.until(() => ui.documentPanel()?.querySelector('[aria-label="Document Markdown"]'), label);
  };
  await open('0001: Proposed decision');
  assert.match(text(ui.documentPanel()), /Status: proposed/);
  await writeFile(join(ui.folder, 'docs/adr/0001-proposed.md'), '# 0001: Accepted decision\n\nStatus: accepted\n');
  await ui.click(ui.document.querySelector('[aria-label="Close Supporting document"]'));
  await ui.until(() => ui.button('0001: Proposed decision', ui.document.querySelector('section[aria-label="Supporting documents"]')) !== undefined, 'stale list is still shown until it reloads');
  await ui.click(ui.button('0001: Proposed decision', ui.document.querySelector('section[aria-label="Supporting documents"]')));
  await ui.until(() => /Status: accepted/.test(text(ui.documentPanel())), 'revisit reads the current file');
  await writeFile(join(ui.folder, 'docs/adr/0001-proposed.md'), '# 0001: Superseded decision\n\nStatus: superseded\n');
  await ui.click(ui.button('Reload document', ui.documentPanel()));
  await ui.until(() => /Status: superseded/.test(text(ui.documentPanel())), 'explicit reload');
  await writeFile(join(ui.folder, 'docs/adr/0002-new.md'), '# 0002: New decision\n');
  await act(async () => { ui.document.defaultView.dispatchEvent(new ui.document.defaultView.Event('focus')); });
  await ui.until(() => ui.button('0002: New decision', ui.document.querySelector('section[aria-label="Supporting documents"]')), 'new ADR listed after focus');
  await ui.until(() => /Superseded decision|Status: superseded/.test(text(ui.documentPanel())), 'open document stays');
});

test('a document removed after listing is reported unavailable', async (t) => {
  const ui = await setup(t);
  await rm(join(ui.folder, 'docs/adr/0001-proposed.md'));
  await ui.click(ui.button('0001: Proposed decision', ui.document.querySelector('section[aria-label="Supporting documents"]')));
  await ui.until(() => /Unavailable: .*does not exist/.test(text(ui.documentPanel())), 'unavailable report');
  assert.equal(ui.documentPanel().querySelector('[aria-label="Document Markdown"]'), null);
  assert.ok([...ui.document.querySelectorAll('[role="status"]')].some((status) => /Cannot read supporting document/.test(text(status))), 'read failures also show a persistent toast');
});

test('Markdown previews keep relative links inert so a draft cannot be navigated away', async (t) => {
  const ui = await setup(t);
  await ui.click(ui.document.querySelector('button[aria-label^="Open #"][aria-label$=" · .scratch/alpha/issues/02-next.md"]'));
  await ui.change(ui.document.querySelector('[aria-label="Markdown body"]'), 'See [the spec](../spec.md) and [site](https://example.com).');
  await ui.click(ui.button('Preview'));
  const preview = ui.document.querySelector('[aria-label="Body preview"]');
  assert.equal(preview.querySelectorAll('a[href="../spec.md"]').length, 0);
  assert.equal(text(preview.querySelector('span[title="Document links open from the saved Markdown."]')), 'the spec');
  assert.equal(preview.querySelector('a[href="https://example.com"]').getAttribute('target'), '_blank');
});

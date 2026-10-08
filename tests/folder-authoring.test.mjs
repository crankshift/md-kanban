import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './fixtures.mjs';
import { startServer } from '../dist/server/server.js';

async function app(t, files) {
  const folder = await fixture(t, files);
  const server = await startServer(folder); t.after(server.close);
  const { sessionToken } = await (await fetch(server.url + '/api/context')).json();
  const get = async path => (await fetch(server.url + path)).json();
  const post = (path, data) => fetch(server.url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': sessionToken, Origin: server.url }, body: JSON.stringify(data) });
  return { folder, get, post };
}

test('repository discovery includes root/arbitrary Markdown and empty folders; visibility never denies explicit reads', async t => {
  const a = await app(t, { 'root.md': '# Root', 'arbitrary/n.md': '# N', 'node_modules/pkg/readme.md': '# Hidden', '.agents/a.markdown': '# Agent' });
  await mkdir(join(a.folder, '.git')); await mkdir(join(a.folder, 'empty'));
  const list = await a.get('/api/documents');
  assert.deepEqual(list.documents.map(d => d.path), ['.agents/a.markdown', 'arbitrary/n.md', 'root.md']);
  assert.ok(list.folders.includes('empty')); assert.ok(list.hidden.includes('node_modules'));
  assert.equal((await a.get('/api/document?path=node_modules/pkg/readme.md')).content, '# Hidden');
  const shown = await a.get('/api/documents?show=' + encodeURIComponent('["node_modules"]'));
  assert.ok(shown.documents.some(d => d.path === 'node_modules/pkg/readme.md'));
  const hidden = await a.get('/api/documents?hide=' + encodeURIComponent('["arbitrary"]'));
  assert.ok(!hidden.documents.some(d => d.path.startsWith('arbitrary/')));
});

test('generic status writes preserve YAML/leading bytes, reject ambiguity and stale revisions, and allow ordinary source/comment edits', async t => {
  const raw = '---\r\nOwner: Ada # keep\r\nStatus: \'In Review\' # status note\r\nOther: [one, two]\r\n---\r\n# Note\r\n\r\n- [x] Keep café.\r\n';
  const a = await app(t, { 'notes/n.markdown': raw, 'duplicates.md': '# D\nStatus: Equal\nStatus: Equal\n', 'object.md': '---\nStatus: [ready]\n---\n# O\n' });
  const doc = await a.get('/api/document?path=notes/n.markdown');
  assert.ok(doc.revision); assert.equal(doc.status.key, 'value:in review');
  const moved = await a.post('/api/status', { path: doc.path, expectedRevision: doc.revision, status: 'Awaiting author' });
  assert.equal(moved.status, 200);
  assert.equal(await readFile(join(a.folder, doc.path), 'utf8'), raw.replace("'In Review'", "'Awaiting author'"));
  assert.equal((await a.post('/api/status', { path: doc.path, expectedRevision: doc.revision, status: 'Stale' })).status, 409);
  for (const path of ['duplicates.md', 'object.md']) {
    const d = await a.get('/api/document?path=' + path); assert.equal(d.status.writable, false);
    assert.equal((await a.post('/api/status', { path, expectedRevision: d.revision, status: 'Ready' })).status, 422);
  }
  const latest = await a.get('/api/document?path=' + doc.path);
  const cleared = await a.post('/api/status', { path: doc.path, expectedRevision: latest.revision, status: null });
  assert.equal(cleared.status, 200);
  const content = await readFile(join(a.folder, doc.path), 'utf8');
  assert.equal(content, raw.replace("Status: 'In Review' # status note\r\n", ''));
  const before = await a.get('/api/document?path=' + doc.path);
  assert.equal((await a.post('/api/source', { path: doc.path, expectedRevision: before.revision, content: content + '\r\nDeliberate edit.' })).status, 200);
  const edited = await a.get('/api/document?path=' + doc.path);
  assert.equal((await a.post('/api/comment', { path: doc.path, expectedRevision: edited.revision, comment: 'Author comment.' })).status, 200);
  assert.match(await readFile(join(a.folder, doc.path), 'utf8'), /## Comments\r\n\r\nAuthor comment\./);
});

test('status groups handle case, blank, authored special names, duplicate equal values and non-text YAML', async t => {
  const files = {
    'upper.md': '# Upper\nStatus: Ready\n', 'lower.md': '# Lower\nStatus: ready\n',
    'blank.md': '---\nStatus: # blank\n---\n# Blank', 'literal.md': '# Literal\nStatus: No status\n',
    'check.md': '# Literal check\nStatus: Check status\n', 'duplicate.md': '# Equal\nStatus: Ready\nStatus: Ready\n',
    'number.md': '---\nStatus: 42\n---\n# Number', 'bool.md': '---\nStatus: true\n---\n# Bool', 'quoted.md': '---\nStatus: "42"\n---\n# Quoted',
  };
  const a = await app(t, files), { documents } = await a.get('/api/documents');
  const by = path => documents.find(d => d.path === path);
  assert.equal(by('upper.md').status.key, by('lower.md').status.key);
  assert.equal(by('blank.md').status.key, '@none'); assert.equal(by('literal.md').status.key, 'value:no status'); assert.equal(by('check.md').status.key, 'value:check status');
  assert.equal(by('duplicate.md').status.writable, false); assert.match(by('duplicate.md').status.reason, /Duplicate/);
  for (const path of ['number.md', 'bool.md']) assert.equal(by(path).status.key, '@check');
  assert.equal(by('quoted.md').status.key, 'value:42');
  const unchanged = await a.post('/api/status', { path: 'lower.md', expectedRevision: by('lower.md').revision, status: 'READY' });
  assert.equal(unchanged.status, 200); assert.equal(await readFile(join(a.folder, 'lower.md'), 'utf8'), files['lower.md']);
});

test('missing, blank, quoted and flow-map status patches preserve exact unrelated Markdown', async t => {
  const examples = [
    ['---\nOwner: Ada\n---\n# N\n', 'Awaiting: author', '---\nOwner: Ada\nStatus: "Awaiting: author"\n---\n# N\n'],
    ['# N\n\nOwner: Ada\n\nBody.\n', 'Next', '# N\n\nStatus: Next\n\nOwner: Ada\n\nBody.\n'],
    ['---\r\nStatus: # keep\r\nOwner: Ada\r\n---\r\n# N', 'Ready', '---\r\nStatus: Ready # keep\r\nOwner: Ada\r\n---\r\n# N'],
    ['```md\n# Example\n```\n\nActual prose.\n', 'Next', 'Status: Next\n```md\n# Example\n```\n\nActual prose.\n'],
    ['---\n" Status ": Ready\nOwner: Ada\n---\n# N', 'Next', '---\n" Status ": Next\nOwner: Ada\n---\n# N'],
    ['---\n{Status: Ready # status comment\n, Owner: Ada}\n---\n# N', null, '---\n{ # status comment\n Owner: Ada}\n---\n# N'],
    ['---\n{Owner: Ada, }\n---\n# N', 'Ready', '---\n{Owner: Ada, Status: Ready}\n---\n# N'],
    ['---\n{Owner: Ada}\n---\n# N', 'Ready', '---\n{Owner: Ada, Status: Ready}\n---\n# N'],
    ['---\n{Status: Ready, Owner: Ada}\n---\n# N', null, '---\n{ Owner: Ada}\n---\n# N'],
  ];
  for (const [index, [before, label, expected]] of examples.entries()) {
    const a = await app(t, { 'n.md': before }), doc = await a.get('/api/document?path=n.md');
    const response = await a.post('/api/status', { path: 'n.md', expectedRevision: doc.revision, status: label });
    assert.equal(response.status, 200, `example ${index}`); assert.equal(await readFile(join(a.folder, 'n.md'), 'utf8'), expected);
  }
});

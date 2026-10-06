import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { discoverIssues } from '../dist/server/discovery.js';
import { fixture, boardFiles } from './fixtures.mjs';

test('renders each workflow with its own columns, real context, and readable attention entries', async (t) => {
  const root = await fixture(t, boardFiles);
  const data = await discoverIssues(root);
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', ssr: { noExternal: ['@fontsource-variable/ibm-plex-sans', '@fontsource/ibm-plex-mono'] } });
  t.after(() => vite.close());
  const { BoardView } = await vite.ssrLoadModule('/Board.tsx');
  const { Provider } = await vite.ssrLoadModule('/components/ui/provider.tsx');
  const implementation = renderToStaticMarkup(createElement(Provider, {}, createElement(BoardView, { data, workflow: 'implementation' })));
  assert.match(implementation, /ready-for-agent/);
  assert.match(implementation, /needs-triage/);
  assert.match(implementation, /#02/);
  assert.match(implementation, /Start/);
  assert.match(implementation, /alpha/);
  assert.doesNotMatch(implementation, />Question</);
  const sameColumn = { ...data, issues: data.issues.map((issue) => issue.title === 'Later' ? { ...issue, status: 'ready-for-agent' } : issue) };
  const sorted = renderToStaticMarkup(createElement(Provider, {}, createElement(BoardView, { data: sameColumn, workflow: 'implementation' })));
  assert.ok(sorted.indexOf('Start') < sorted.indexOf('Later'));
  const wayfinding = renderToStaticMarkup(createElement(Provider, {}, createElement(BoardView, { data, workflow: 'wayfinding' })));
  assert.match(wayfinding, /Question/);
  assert.match(wayfinding, /Review/);
  assert.match(wayfinding, /claimed/);
  assert.match(wayfinding, /resolved/);
  assert.doesNotMatch(wayfinding, /ready-for-agent|>Start</);
  const hostile = { ...data, issues: [{ ...data.issues[0], title: '<script>alert(1)</script>', workflow: null, diagnostics: ['<img src=x onerror=alert(1)>'], content: '<script>alert(1)</script>' }] };
  const attention = renderToStaticMarkup(createElement(Provider, {}, createElement(BoardView, { data: hostile, attentionOnly: true, workflow: 'implementation' })));
  assert.doesNotMatch(attention, /<script>alert|<img /);
  assert.match(attention, /&lt;script&gt;/);
});

test('search, location and scoped feature filters compose while dependencies use the whole board', async (t) => {
  const root = await fixture(t, {
    '.scratch/alpha/issues/01-start.md': '# 01: Start\nStatus: ready-for-agent\n\n## Notes\nneedle in the body\n',
    '.scratch/alpha/issues/02-next.md': '# 02: Needle follow-up\nStatus: ready-for-agent\nBlocked by: 01, 99\n',
    '.scratch/beta/issues/01-other.md': '# 01: Needle beta\nStatus: ready-for-agent\n',
    'docs/alpha/issues/01-other.md': '# 01: Needle docs\nStatus: ready-for-agent\n',
  });
  const data = await discoverIssues(root);
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', ssr: { noExternal: ['@fontsource-variable/ibm-plex-sans', '@fontsource/ibm-plex-mono'] } });
  t.after(() => vite.close());
  const { BoardView } = await vite.ssrLoadModule('/Board.tsx');
  const { Provider } = await vite.ssrLoadModule('/components/ui/provider.tsx');
  const render = (filters) => renderToStaticMarkup(createElement(Provider, {}, createElement(BoardView, { data, workflow: 'implementation', filters })));
  const all = render({ query: ' NEEDLE ', location: '', feature: '' });
  assert.equal((all.match(/aria-label="Issue #/g) ?? []).length, 4);
  const location = render({ query: 'needle', location: '.scratch', feature: '' });
  assert.equal((location.match(/aria-label="Issue #/g) ?? []).length, 3);
  const feature = render({ query: 'needle', location: '.scratch', feature: JSON.stringify(['.scratch', 'alpha']) });
  assert.equal((feature.match(/aria-label="Issue #/g) ?? []).length, 2);
  assert.doesNotMatch(feature, /Needle beta|Needle docs/);
  assert.ok(feature.indexOf('Start') < feature.indexOf('Needle follow-up'));
  const titleOnly = render({ query: 'follow-up', location: '.scratch', feature: JSON.stringify(['.scratch', 'alpha']) });
  assert.equal((titleOnly.match(/aria-label="Issue #/g) ?? []).length, 1);
  assert.match(titleOnly, /1 advisory dependency/);
  assert.match(titleOnly, /1 dependency reference needs attention/);
  assert.match(render({ query: 'absent', location: '', feature: '' }), /No implementation issues match/);
});

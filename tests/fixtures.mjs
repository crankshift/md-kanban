import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export async function fixture(t, files) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'mdkanban-fixture-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

export const boardFiles = {
  '.scratch/alpha/issues/10-later.md': '# 10: Later\n\nStatus: needs-info\nBlocked by: None\n',
  '.scratch/alpha/issues/02-start.md': '# 02: Start\n\n**Status:** ready-for-agent\n**Blocked by:** 01 — Launch\n',
  '.scratch/beta/tickets/01-question.md': '# 01: Question\n\nStatus: open\nType: research\nBlocked by: None (first issue)\n',
  'docs/tickets/gamma/issues/01-review.md': '# 01: Review\n\nStatus: resolved\nType: task\n',
  'docs/delta/tickets/01-delta.md': '# 01: Delta\n\nStatus: ready-for-human\n',
  '.scratch/alpha/issues/03-broken.md': '# 03: Broken\n\nStatus: done\n',
  '.scratch/alpha/spec.md': '# Specification\n\nStatus: ready-for-agent\n',
  '.scratch/beta/map.md': '# Map\nStatus: open\n',
  '.scratch/alpha/issues/spec.md': '# 20: Specification\nStatus: proposed\n',
  '.scratch/alpha/issues/map.md': '# 21: Map\nStatus: open\n',
  '.scratch/alpha/issues/README.md': '# Documentation\n',
  'docs/adr/0001-proposed.md': '# 0001: Proposed\n\nStatus: proposed\n',
  'docs/guide.md': '# Guide\nStatus: open\n',
  'node_modules/example/issues/01-vendor.md': '# 01: Vendor\nStatus: open\n',
  'dist/issues/01-generated.md': '# 01: Generated\nStatus: open\n',
};

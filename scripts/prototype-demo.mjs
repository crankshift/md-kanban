#!/usr/bin/env node
// PROTOTYPE — throwaway. Seeds a disposable demo folder (both workflows, two locations, supporting documents,
// an unrecognized issue candidate) and launches the board on it. Pass a folder to use that instead.
import { spawn } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith('--'));
const given = args.find((arg) => !arg.startsWith('--'));
let folder = given && resolve(given);

if (!folder) {
  folder = join(tmpdir(), 'md-kanban-prototype-WIPE-ME');
  await rm(folder, { recursive: true, force: true });
  await cp(join(repo, '.scratch'), join(folder, '.scratch'), { recursive: true });
  await cp(join(repo, 'docs/adr'), join(folder, 'docs/adr'), { recursive: true });
  const files = {
    '.scratch/markdown-kanban/issues/10-polish-card-density.md':
      '# 10: Polish card density\n\n**Status:** in-progress\n\n## Outcome\n\nCards fit more issues per column.\n',
    '.scratch/board-redesign/map.md':
      '# Board redesign\n\n## Notes\n\nWhich layout lets people scan many features at once?\n\n## Decisions so far\n\n- Detail view must not squeeze the columns. See [the spec](../markdown-kanban/spec.md).\n\n## Fog\n\n- Is a list view more useful than columns for large repos?\n',
    '.scratch/board-redesign/issues/01-survey-existing-boards.md':
      '# 01: Survey how existing boards show details\n\nType: research\nStatus: resolved\n\nCompare GitHub Projects, Linear, and Jira detail views.\n\n## Answer\n\nOverlays win when columns matter; full pages win for long specs.\n',
    '.scratch/board-redesign/issues/02-prototype-detail-surfaces.md':
      '# 02: Prototype three detail surfaces\n\nType: prototype\nStatus: claimed\nBlocked by: 01\n\nDrawer, dialog, and full page on real data.\n',
    '.scratch/board-redesign/issues/03-decide-navigation-model.md':
      '# 03: Decide the navigation model for many features\n\nType: grilling\nStatus: open\nBlocked by: 01, 02\n\nSidebar tree or filter toolbar?\n',
    '.scratch/board-redesign/issues/04-keyboard-moves.md':
      '# 04: Can status moves be fully keyboard driven?\n\nType: research\nStatus: open\nBlocked by: 02\n\nCheck drag-and-drop keyboard sensors.\n',
    '.scratch/board-redesign/issues/05-palette-check.md':
      '# 05: Check palette contrast in dark mode\n\nType: task\nStatus: open\n\nAll status colours must pass contrast checks.\n',
    'docs/billing-export/spec.md':
      '# Billing export\n\nExport invoices as CSV for accounting. See [ADR 0003](../adr/0003-preserve-shared-markdown-files.md).\n',
    'docs/billing-export/tickets/01-csv-schema.md':
      '# 01: Define the CSV schema\n\nStatus: ready-for-human\nBlocked by: None\n\n## Outcome\n\nColumns agreed with accounting.\n',
    'docs/billing-export/tickets/02-export-endpoint.md':
      '# 02: Export endpoint\n\nStatus: ready-for-agent\nBlocked by: 01 — Define the CSV schema\n\n## Outcome\n\nA download link returns the CSV.\n',
    'docs/billing-export/tickets/03-retry-failed-exports.md':
      '# 03: Retry failed exports\n\nStatus: needs-info\nBlocked by: 02, 07\n\nWhat counts as a failed export?\n',
    'docs/billing-export/tickets/04-legacy-pdf.md':
      '# 04: Keep the legacy PDF export\n\nStatus: wontfix\n\nAccounting confirmed PDFs are unused.\n',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), content);
  }
  console.log(`Demo folder (safe to delete): ${folder}`);
}

const child = spawn(process.execPath, [join(repo, 'dist/server/cli.js'), folder, ...flags], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { process.exitCode = code ?? 0; });

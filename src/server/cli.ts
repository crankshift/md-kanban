#!/usr/bin/env node
import { access, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import open from 'open';
import { startServer } from './server.js';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: { 'no-open': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
    allowPositionals: true,
  });
  if (values.help) {
    console.log('Usage: md-kanban [folder] [--no-open]\nDefaults to the caller’s current directory. Press Ctrl+C to stop.');
    return;
  }
  if (positionals.length > 1) throw new Error('Expected at most one folder. Usage: md-kanban [folder] [--no-open]');
  const folder = resolve(process.cwd(), positionals[0] ?? '.');
  try {
    if (!(await stat(folder)).isDirectory()) throw new Error('not a directory');
    await access(folder, constants.R_OK | constants.X_OK);
    await readdir(folder);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot use folder "${folder}": ${reason}. Choose an existing, readable directory.`);
  }
  const { url, close } = await startServer(folder);
  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    close().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  console.log(`md-kanban: ${url}\nSelected folder: ${folder}\nPress Ctrl+C to stop.`);
  if (!values['no-open']) {
    try {
      const opener = await open(url);
      opener.once('error', () => {
        console.error(`Could not open your browser. Open ${url} manually; the server is still running.`);
      });
      opener.once('close', (code) => {
        if (code !== 0) console.error(`Could not open your browser. Open ${url} manually; the server is still running.`);
      });
    } catch {
      console.error(`Could not open your browser. Open ${url} manually; the server is still running.`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(`md-kanban: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

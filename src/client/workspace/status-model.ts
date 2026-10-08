import type { Document } from './model';
export type StatusColumn = { key: string; label: string };
export type StatusMemory = Record<string, { key: string; label: string; paths: Set<string> }[]>;
export const authoredKey = (label: string) => 'value:' + label.trim().toLowerCase();
const inside = (path: string, folder: string) => !folder || path === folder || path.startsWith(folder + '/');

export function scopeColumns(scoped: Document[], scope: string, hidden: string[], memory: StatusMemory, extras: string[]): StatusColumn[] {
  const known = memory[scope] ??= [];
  for (const doc of scoped) {
    if (!doc.status.key.startsWith('value:')) continue;
    const old = known.find(c => c.key === doc.status.key);
    if (old) old.paths.add(doc.path); else known.push({ key: doc.status.key, label: doc.status.label, paths: new Set([doc.path]) });
  }
  const columns = known.filter(c => [...c.paths].some(path => !hidden.some(folder => inside(path, folder)))).map(({ key, label }) => ({ key, label }));
  for (const label of extras) if (!columns.some(c => c.key === authoredKey(label))) columns.push({ key: authoredKey(label), label });
  columns.sort((a, b) => a.label.localeCompare(b.label));
  columns.push({ key: '@none', label: 'No status' });
  if (scoped.some(doc => doc.status.key === '@check')) columns.push({ key: '@check', label: 'Check status' });
  return columns;
}

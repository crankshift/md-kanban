import type { SupportingDocument } from '../../server/document-types.js';

export type Document = SupportingDocument;
export const labelOf = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);
export type MapSettings = {
  mode: 'global' | 'local'; relation: 'all' | 'link' | 'dependency';
  presentation: 'overview' | 'directed' | 'folders'; connections: 'focus' | 'all'; dependency: string;
};
export function mapSettings(params: URLSearchParams): MapSettings {
  const relation = params.get('relation');
  const presentation = params.get('layout');
  return { mode: params.get('map') === 'local' ? 'local' : 'global',
    relation: relation === 'link' || relation === 'dependency' ? relation : 'all',
    presentation: presentation === 'directed' || presentation === 'folders' ? presentation : 'overview',
    connections: params.get('connections') === 'all' ? 'all' : 'focus', dependency: params.get('dependency') ?? '' };
}

/** Identities are separate from labels: an authored “No value” or Folder never aliases a UI choice. */
export function propertyValue(document: Document, key: string) {
  const occurrences = document.properties.filter((entry) => entry.key === key);
  if (!occurrences.length) return { id: 'missing', label: 'No value', choiceLabel: 'No value (missing property)' };
  if (occurrences.some((entry) => !entry.valid)) return { id: JSON.stringify(['invalid', occurrences.map((entry) => entry.raw)]), label: 'Invalid metadata', choiceLabel: 'Invalid metadata (see notices)' };
  const values = [...new Set(occurrences.map((entry) => entry.value))];
  return { id: JSON.stringify(['values', values]), label: (values.length > 1 ? 'Conflicting: ' : '') + values.map((value) => value || '(empty)').join(' · '),
    choiceLabel: values.length > 1 ? `Conflicting values: ${JSON.stringify(values)}` : values[0] === '' ? 'Empty property' : JSON.stringify(values[0]) };
}

export function groupDocuments(documents: Document[], grouping: string) {
  const groups = new Map<string, { id: string; label: string; documents: Document[] }>();
  for (const document of documents) {
    const value = grouping.startsWith('property:') ? propertyValue(document, grouping.slice(9)) : { id: document.folder, label: document.folder };
    const group = groups.get(value.id) ?? { ...value, documents: [] };
    group.documents.push(document);
    groups.set(value.id, group);
  }
  return [...groups.values()].sort((a, b) => a.id === 'missing' ? 1 : b.id === 'missing' ? -1 : a.label.localeCompare(b.label));
}

export function folderPaths(documents: Document[]) {
  return [...new Set(documents.flatMap((document) => {
    const parts = document.folder === '.' ? [] : document.folder.split('/');
    return parts.map((_part, index) => parts.slice(0, index + 1).join('/'));
  }))].sort();
}

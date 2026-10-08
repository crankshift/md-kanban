import { isMap, isScalar, parseDocument } from 'yaml';
import { documentMetadata } from './markdown-metadata.js';
import type { DocumentStatus } from './document-types.js';

export const statusKey = (label: string): string => 'value:' + label.trim().toLowerCase();
const frontOf = (content: string) => content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/);

/** Derive stable system/authored identities without interpreting an author's workflow. */
export function documentStatus(content: string | null): DocumentStatus {
  if (content === null) return { key: '@none', label: 'No status', writable: false, reason: 'Preview unavailable.' };
  const metadata = documentMetadata(content);
  const entries = metadata.properties.filter(p => p.key === 'status');
  const front = frontOf(content);
  let nonText = entries.some(p => !p.valid || p.values.length > 1 || /[\r\n]/.test(p.value));
  if (front) {
    const yaml = parseDocument(front[1]!, { uniqueKeys: false });
    if (isMap(yaml.contents)) for (const pair of yaml.contents.items) {
      if (isScalar(pair.key) && String(pair.key.value).trim().toLowerCase() === 'status' && pair.value && (!isScalar(pair.value) || (typeof pair.value.value !== 'string' && !!pair.value.source))) nonText = true;
    }
    if (yaml.errors.length || (yaml.contents && !isMap(yaml.contents))) nonText = true;
  }
  const labels = new Set(entries.map(p => p.value.trim().toLowerCase()));
  const ambiguous = nonText || labels.size > 1 || metadata.diagnostics.some(d => d.startsWith('Frontmatter: missing') || d.startsWith('Malformed leading'));
  const label = entries[0]?.value.trim() ?? '';
  const reason = ambiguous ? 'Conflicting or non-text status metadata; use Edit to correct the source.' : entries.length > 1 ? 'Duplicate status properties; use Edit to correct the source.' : '';
  return { key: ambiguous ? '@check' : label ? statusKey(label) : '@none', label: ambiguous ? 'Check status' : label || 'No status', writable: !reason, reason };
}

function yamlValue(label: string, old = '') {
  if (old.startsWith("'")) return "'" + label.replace(/'/g, "''") + "'";
  if (old.startsWith('"') || !/^[\p{L}\p{N} _./-]+$/u.test(label) || /^(?:true|false|null|~|[\d+-])/i.test(label)) return JSON.stringify(label);
  return label;
}

/** Change only the authored scalar/property range; never regenerate a YAML document. */
export function patchDocumentStatus(content: string, label: string | null): string {
  const result = patchStatus(content, label);
  const next = documentStatus(result);
  if (!next.writable || next.key !== (label === null ? '@none' : statusKey(label))) throw new Error('Cannot safely represent this status change. Use Edit to correct the source.');
  return result;
}

function patchStatus(content: string, label: string | null): string {
  const status = documentStatus(content);
  if (!status.writable) throw new Error(status.reason);
  if ((label === null ? '@none' : statusKey(label)) === status.key) return content;
  const entry = documentMetadata(content).properties.find(p => p.key === 'status');
  const front = frontOf(content);
  const nl = content.includes('\r\n') ? '\r\n' : '\n';
  if (entry?.source === 'frontmatter' && front) {
    const raw = front[1]!, offset = front[0].indexOf('\n') + 1;
    const yaml = parseDocument(raw, { schema: 'failsafe', uniqueKeys: false, keepSourceTokens: true });
    if (isMap(yaml.contents)) for (const pair of yaml.contents.items) {
      if (!isScalar(pair.key) || String(pair.key.value).trim().toLowerCase() !== 'status') continue;
      const key = pair.key.range!;
      const range = pair.value?.range;
      if (label === null) {
        // Flow mappings cannot remove a line without also removing unrelated properties.
        if (yaml.contents.flow) {
          const token = yaml.contents.srcToken;
          if (token?.type !== 'flow-collection') throw new Error('Cannot identify the status separator. Use Edit.');
          const index = yaml.contents.items.indexOf(pair);
          const comma = token.items[index + 1]?.start.find(token => token.type === 'comma') ?? token.items[index]?.start.find(token => token.type === 'comma');
          const ranges = [{ start: key[0], end: range?.[1] ?? key[1] }, ...(comma ? [{ start: comma.offset, end: comma.offset + 1 }] : [])].sort((a, b) => b.start - a.start);
          let result = content;
          for (const range of ranges) result = result.slice(0, offset + range.start) + result.slice(offset + range.end);
          return result;
        }
        const start = raw.lastIndexOf('\n', key[0] - 1) + 1;
        const end = raw.indexOf('\n', range?.[1] ?? key[1]);
        return content.slice(0, offset + start) + content.slice(offset + (end < 0 ? raw.length : end + 1));
      }
      if (range) return content.slice(0, offset + range[0]) + yamlValue(label, raw.slice(range[0], range[1])) + (range[0] === range[1] && raw[range[1]] === '#' ? ' ' : '') + content.slice(offset + range[1]);
      const colon = raw.indexOf(':', key[1]);
      const after = colon + 1 + (raw.slice(colon + 1).match(/^[ \t]*/)?.[0].length ?? 0);
      return content.slice(0, offset + after) + yamlValue(label) + content.slice(offset + after);
    }
  }
  if (entry?.source === 'leading') {
    const body = documentMetadata(content).body, offset = content.length - body.length;
    const start = content.indexOf(entry.raw, offset);
    if (label === null) return content.slice(0, start) + content.slice(start + entry.raw.length).replace(/^\r?\n/, '');
    const match = entry.raw.match(/^((?:\*\*[^*]+:\*\*|\*\*[^*]+\*\*:|[^:]+:)[ \t]*)(.*?)([ \t]*)$/)!;
    return content.slice(0, start) + match[1] + label + match[3] + content.slice(start + entry.raw.length);
  }
  if (label === null) return content;
  if (front) {
    const yaml = parseDocument(front[1]!, { schema: 'failsafe', uniqueKeys: false, keepSourceTokens: true });
    if (isMap(yaml.contents) && yaml.contents.flow) {
      const at = front[0].indexOf('\n') + 1 + yaml.contents.range![1] - 1;
      const token = yaml.contents.srcToken;
      const last = token?.type === 'flow-collection' ? token.items.at(-1) : undefined;
      const trailingComma = last && !last.key && !last.value && last.start.some(token => token.type === 'comma');
      return content.slice(0, at) + (yaml.contents.items.length && !trailingComma ? ', ' : '') + 'Status: ' + yamlValue(label) + content.slice(at);
    }
    const close = front[0].search(/(?:---|\.\.\.)(?:\r?\n)?$/);
    return content.slice(0, close) + 'Status: ' + yamlValue(label) + nl + content.slice(close);
  }
  const heading = content.match(/^\uFEFF?(?:[ \t]*\r?\n)* {0,3}#[ \t]+[^\r\n]*(?:\r?\n|$)/);
  const at = heading ? heading.index! + heading[0].length : content.startsWith('\uFEFF') ? 1 : 0;
  return content.slice(0, at) + (heading && !heading[0].endsWith('\n') ? nl : '') + (heading ? nl : '') + 'Status: ' + label + nl + content.slice(at);
}

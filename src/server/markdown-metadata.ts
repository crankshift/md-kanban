import { isMap, isScalar, parseDocument } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent } from 'mdast';
import type { DocumentProperty } from './document-types.js';

const parser = unified().use(remarkParse).use(remarkGfm);
const displayValue = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value) ?? '';

/** Read optional metadata without assigning lifecycle meaning or discarding duplicate occurrences. */
export function documentMetadata(content: string) {
  const properties: DocumentProperty[] = [];
  const diagnostics: string[] = [];
  let body = content.replace(/^\uFEFF/, '');
  if (/^---\r?\n/.test(body)) {
    const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/);
    if (!frontmatter) return { properties, diagnostics: ['Frontmatter: missing closing delimiter.'], body };
    const raw = frontmatter[1]!;
    // Failsafe retains literal scalars such as 01 and null. Alias expansion is bounded explicitly.
    const yaml = parseDocument(raw, { uniqueKeys: false, schema: 'failsafe' });
    const duplicateKeys = parseDocument(raw, { schema: 'failsafe' }).errors.filter((error) => error.code === 'DUPLICATE_KEY');
    diagnostics.push(...[...yaml.errors, ...yaml.warnings].map((error) => `Frontmatter: ${error.message.split('\n')[0]}`));
    if (isMap(yaml.contents)) {
      for (const pair of yaml.contents.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string' || !pair.key.value.trim()) {
          diagnostics.push('Frontmatter: property names must be nonempty text.');
          continue;
        }
        const label = pair.key.value.trim();
        const start = pair.key.range?.[0] ?? 0;
        const end = pair.value?.range?.[2] ?? pair.key.range?.[2] ?? raw.length;
        let value: unknown = '';
        let valid = yaml.errors.length === 0;
        if (duplicateKeys.some((error) => error.pos[0] >= (pair.value?.range?.[0] ?? end) && error.pos[0] < end)) {
          valid = false;
          diagnostics.push(`Frontmatter: duplicate mapping key inside “${label}”; original value is retained.`);
        }
        try { value = pair.value?.toJS(yaml, { maxAliasCount: 50 }) ?? ''; }
        catch { valid = false; diagnostics.push(`Frontmatter: “${label}” cannot be safely expanded.`); }
        properties.push({ key: label.toLowerCase(), label, value: valid ? displayValue(value) : raw.slice(start, end).trim(),
          values: valid ? (Array.isArray(value) ? value : [value]).map(displayValue) : [],
          source: 'frontmatter', raw: raw.slice(start, end), valid });
      }
    } else if (yaml.contents) diagnostics.push('Frontmatter: expected a property mapping.');
    body = body.slice(frontmatter[0].length);
  }
  let heading = false;
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!heading && /^ {0,3}#\s/.test(line)) { heading = true; continue; }
    const match = line.match(/^[ \t]{0,3}(?:\*\*([^*:\n]+):\*\*|\*\*([^*:\n]+)\*\*:|([\p{L}][\p{L}\p{N} _./-]{0,100}):)[ \t]*(.*?)[ \t]*$/u);
    if (!match) {
      if (/^[ \t]{0,3}(?:\*\*[^*\n]+:|(?:\*\*)?Status\b)/i.test(line)) diagnostics.push('Malformed leading property; original Markdown is retained.');
      break;
    }
    const label = (match[1] ?? match[2] ?? match[3])!.trim();
    properties.push({ key: label.toLowerCase(), label, value: match[4]!, values: [match[4]!], source: 'leading', raw: line, valid: true });
  }
  const keys = new Set(properties.map((entry) => entry.key));
  for (const key of keys) {
    const entries = properties.filter((entry) => entry.key === key);
    if (entries.length > 1) diagnostics.push(`${new Set(entries.map((entry) => entry.value)).size > 1 ? 'Conflicting' : 'Duplicate'} “${key}” properties; all occurrences are retained.`);
  }
  return { properties, diagnostics, body };
}

/** Reference definitions are resolved from the AST; code and inline-code examples have no links. */
export function markdownLinks(content: string): string[] {
  const tree = parser.parse(content);
  const definitions = new Map<string, string>();
  const links: string[] = [];
  function visit(node: Root | RootContent, callback: (node: Root | RootContent) => void) {
    callback(node);
    if ('children' in node) for (const child of node.children) visit(child, callback);
  }
  visit(tree, (node) => { if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url); });
  visit(tree, (node) => {
    if (node.type === 'link') links.push(node.url);
    if (node.type === 'linkReference') { const href = definitions.get(node.identifier); if (href) links.push(href); }
  });
  return links;
}

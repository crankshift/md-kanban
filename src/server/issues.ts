import { patchDocumentStatus } from './status.js';
import { leadingMetadata } from './document.js';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { type Issue, type IssueContext } from './board.js';

export function filenameNumber(path: string): string | null {
  return basename(path).match(/^(\d+)(?:[-_. ]|\.md$)/i)?.[1] ?? null;
}

export function numberedHeading(content: string): { number: string; title: string } | null {
  const first = content.replace(/^\uFEFF/, '').match(/^#[ \t]+([^\r\n]+)$/m)?.[1];
  const heading = first?.match(/^(\d+)(?:\s*[:.\-–—]\s*|\s+)(.+?)\s*#*\s*$/);
  return heading?.[1] && heading[2] ? { number: heading[1], title: heading[2] } : null;
}

export function patchIssueStatus(issue: Issue, status: string | null): string {
  if (issue.content === null) throw new Error('Document is unavailable.');
  return patchDocumentStatus(issue.content, status);
}

export function patchIssueTitle(issue: Issue, title: string): string {
  const content = issue.content!;
  const heading = content.match(/^(\uFEFF?#\s+)((?:\d+(?:\s*[:.\-–—]\s*|\s+))?)(.+?)(\s*#*\s*)(\r?\n|$)/m);
  if (!heading) throw new Error('Cannot identify the title heading.');
  const start = heading.index! + heading[1]!.length + heading[2]!.length;
  const updated = content.slice(0, start) + title + content.slice(start + heading[3]!.length);
  if (parseIssue(issue, updated).title !== title) throw new Error('This title cannot be represented safely in the existing heading.');
  return updated;
}

export function parseIssue(context: IssueContext, content: string): Issue {
  const diagnostics: string[] = [];
  const heading = content.replace(/^\uFEFF/, '').match(/^#\s+(.+?)\s*#*\s*$/m);
  const numbered = numberedHeading(content);
  const fromFile = filenameNumber(context.path);
  const number = fromFile ?? numbered?.number ?? null;
  if (!number) diagnostics.push('Missing issue number in filename or heading.');
  if (fromFile && numbered && Number(fromFile) !== Number(numbered.number)) diagnostics.push('Filename and heading issue numbers disagree.');
  const title = numbered?.title ?? heading?.[1] ?? basename(context.path);
  if (!heading || /^\d+\s*[:.\-–—]?\s*$/.test(title)) diagnostics.push('Missing issue title in a top-level heading.');

  // Only the leading metadata block is structured. Body examples and comments stay freeform.
  const metadata = new Map<string, string>();
  for (const { line, match } of leadingMetadata(content)) {
    if (!match) {
      if (/^\s*(?:\*\*)?(Status|Type|Blocked by)\b/i.test(line)) diagnostics.push(`Malformed metadata: ${line.trim()}`);
      continue;
    }
    const key = (match[2] ?? match[3] ?? match[4] ?? '').toLowerCase();
    if (metadata.has(key)) diagnostics.push(`Duplicate ${key} metadata.`);
    metadata.set(key, match[5] ?? '');
  }
  const status = metadata.get('status') ?? null;
  const type = metadata.get('type') ?? null;
  const dependencyText = metadata.get('blocked by') ?? null;
  if (!status) diagnostics.push('Missing status.');




  return {
    ...context, id: context.path, number, title, status,
    workflow: null,
    type, dependencyText, content,
    revision: createHash('sha256').update(content, 'utf8').digest('hex'), diagnostics,
  };
}

import { leadingMetadata } from './document.js';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { implementationStatus, wayfindingStatus, wayfindingType, type Issue, type IssueContext } from './board.js';

export function filenameNumber(path: string): string | null {
  return basename(path).match(/^(\d+)(?:[-_. ]|\.md$)/i)?.[1] ?? null;
}

export function numberedHeading(content: string): { number: string; title: string } | null {
  const first = content.replace(/^\uFEFF/, '').match(/^#[ \t]+([^\r\n]+)$/m)?.[1];
  const heading = first?.match(/^(\d+)(?:\s*[:.\-–—]\s*|\s+)(.+?)\s*#*\s*$/);
  return heading?.[1] && heading[2] ? { number: heading[1], title: heading[2] } : null;
}

export function patchIssueStatus(issue: Issue, status: string): string {
  const schema = issue.workflow === 'implementation' ? implementationStatus : wayfindingStatus;
  if (!issue.workflow || issue.content === null || !schema.safeParse(status).success) {
    throw new Error('Choose a supported status in this issue’s workflow.');
  }
  for (const { match, start } of leadingMetadata(issue.content)) {
    if (match && (match[2] ?? match[3] ?? match[4])?.toLowerCase() === 'status') {
      const valueStart = start + (match[1]?.length ?? 0);
      return issue.content.slice(0, valueStart) + status + issue.content.slice(valueStart + (match[5]?.length ?? 0));
    }
  }
  throw new Error('Cannot identify status metadata. Reload and check the issue.');
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
  const implementation = implementationStatus.safeParse(status).success;
  const wayfinding = wayfindingStatus.safeParse(status).success;
  if (!status) diagnostics.push('Missing status.');
  else if (!implementation && !wayfinding) diagnostics.push(`Unknown status: ${status}.`);
  if (type !== null && !wayfindingType.safeParse(type).success) diagnostics.push(`Unknown wayfinding type: ${type || '(empty)'}.`);
  if (implementation && type !== null) diagnostics.push('Ambiguous workflow: implementation status with wayfinding Type metadata.');
  if (!implementation && !wayfinding) diagnostics.push('Workflow cannot be determined from a supported status.');
  return {
    ...context, id: context.path, number, title, status,
    workflow: diagnostics.length ? null : implementation ? 'implementation' : 'wayfinding',
    type, dependencyText, content,
    revision: createHash('sha256').update(content, 'utf8').digest('hex'), diagnostics,
  };
}

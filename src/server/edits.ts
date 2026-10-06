import type { Issue, IssueChanges } from './board.js';
import { resolveDependencies } from './dependencies.js';
import { leadingMetadata, patchIssueBody } from './document.js';
import { parseIssue, patchIssueStatus, patchIssueTitle } from './issues.js';

function patchDependencies(issue: Issue, paths: string[], issues: Issue[]): string {
  const targets = paths.map((path) => {
    const target = issues.find((candidate) => candidate.id === path);
    if (!target || target.location !== issue.location || target.feature !== issue.feature || target.id === issue.id || !target.number) {
      throw new Error('Select dependencies from this feature / effort and location, excluding this issue.');
    }
    const references = resolveDependencies({ ...issue, dependencyText: target.number }, issues);
    if (references[0]?.kind !== 'linked' || references[0].target.id !== target.id) throw new Error('This dependency number is ambiguous. Resolve it in Markdown before selecting it.');
    return target;
  });
  const existing = resolveDependencies(issue, issues);
  if (existing.every((dependency) => dependency.kind === 'linked') && existing.length === paths.length &&
    existing.every((dependency) => dependency.kind === 'linked' && paths.includes(dependency.target.id))) return issue.content!;
  const value = targets.map((target) => target.number).join(', ') || 'None';
  let end = 0;
  let key = 'Blocked by:';
  for (const entry of leadingMetadata(issue.content!)) {
    end = entry.end;
    if (!entry.match) continue;
    const name = (entry.match[2] ?? entry.match[3] ?? entry.match[4])!.toLowerCase();
    if (name === 'status') key = entry.match[1]!.replace(/status/i, 'Blocked by').trim();
    if (name === 'blocked by') {
      const start = entry.start + entry.match[1]!.length;
      return issue.content!.slice(0, start) + value + issue.content!.slice(start + entry.match[5]!.length);
    }
  }
  const newline = issue.content!.includes('\r\n') ? '\r\n' : '\n';
  return issue.content!.slice(0, end) + (issue.content!.slice(0, end).endsWith('\n') ? '' : newline) +
    `${key} ${value}${newline}` + issue.content!.slice(end);
}

export function editIssue(issue: Issue, changes: IssueChanges, issues: Issue[]): string {
  let content = issue.content!;
  if (changes.title !== undefined) content = patchIssueTitle(issue, changes.title);
  if (changes.status !== undefined) content = patchIssueStatus(parseIssue(issue, content), changes.status);
  if (changes.dependencies !== undefined) content = patchDependencies(parseIssue(issue, content), changes.dependencies, issues);
  if (changes.body !== undefined) content = patchIssueBody(content, changes.body);
  return content;
}

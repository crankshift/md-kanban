import { compareIssues, type Issue } from './board.js';

export type Dependency = { reference: string } & (
  | { kind: 'linked'; target: Issue; state: 'advisory' | 'blocked' | 'resolved' | 'unknown' }
  | { kind: 'missing' | 'unsupported' }
  | { kind: 'ambiguous'; candidates: Issue[] }
);

const normalizedNumber = (number: string): string => number.replace(/^0+(?=\d)/, '');
const referenceNumber = (reference: string): RegExpMatchArray | null => reference.match(/^#?(\d+)(?=$|\s|[:.\-–—])/u);

function dependencyReferences(text: string): string[] {
  const references: string[] = [];
  let hasTitle = false;
  for (const part of text.split(',')) {
    const reference = part.trim();
    const number = referenceNumber(reference);
    // Title prose can contain commas. A subsequent numbered reference starts a new entry.
    // After a bare number, unnumbered entries remain unsupported references for diagnosis.
    if (hasTitle && !number && reference) {
      const index = references.length - 1;
      references[index] += `,${part}`;
    } else {
      references.push(reference);
      hasTitle = number !== null && reference.slice(number[0].length).trim().replace(/^[:.\-–—]\s*/u, '').length > 0;
    }
  }
  return references;
}

export function resolveDependencies(issue: Issue, issues: Issue[]): Dependency[] {
  const text = issue.dependencyText?.trim();
  if (text === undefined || /^none(?:\s*\([^\r\n]*\))?\.?$/i.test(text)) return [];
  return dependencyReferences(text).map((reference): Dependency => {
    const number = referenceNumber(reference)?.[1];
    if (!number) return { reference, kind: 'unsupported' };
    const candidates = issues.filter((candidate) => candidate.feature === issue.feature &&
      candidate.location === issue.location && candidate.number !== null &&
      normalizedNumber(candidate.number) === normalizedNumber(number)).sort(compareIssues);
    const target = candidates[0];
    if (!target) return { reference, kind: 'missing' };
    if (candidates.length > 1) return { reference, kind: 'ambiguous', candidates };
    const state = 'advisory';
    return { reference, kind: 'linked', target, state };
  });
}

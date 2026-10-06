// PROTOTYPE — throwaway. Reads the real local server; every write is an in-memory stub with optimistic updates.
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { boardSchema, compareIssues, creationTargetSchema, implementationStatuses, type CreationTarget, type Issue, type Workflow } from '../../server/board.js';
import { documentListSchema, type SupportingDocument } from '../../server/document-types.js';
import { appendIssueComment, issueDocument, patchIssueBody } from '../../server/document.js';
import { toaster } from '../components/ui/toaster';

export type EditValues = { title: string; status: string; body: string };
export type Recovery = { issueId: string; baseRevision: string | null; values: EditValues };
export type Filters = { query: string; location: string; feature: string };
export const noFilters: Filters = { query: '', location: '', feature: '' };

const randomRevision = () => [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const statusesFor = (workflow: Workflow): readonly string[] =>
  workflow === 'implementation' ? implementationStatuses : ['open', 'claimed', 'resolved'];
export const scopeLabel = (workflow: Workflow | null) => workflow === 'wayfinding' ? 'Effort' : 'Feature';
export const featureKey = (issue: Pick<Issue, 'location' | 'feature'>) => `${issue.location}\u0000${issue.feature}`;

export function bodyOf(issue: Issue): string {
  if (issue.content === null) return '';
  try { return issueDocument(issue.content).body; } catch { return issue.content; }
}
export function commentsOf(issue: Issue): string {
  if (issue.content === null) return '';
  try { return issueDocument(issue.content).comments.replace(/^##\s+Comments\s*\n/i, '').trim(); } catch { return ''; }
}

function withStatus(issue: Issue, status: string): Issue {
  const content = issue.content?.replace(/^(\s*(?:\*\*Status:\*\*|\*\*Status\*\*:|Status:)[ \t]*).*$/im, `$1${status}`) ?? null;
  return { ...issue, status, content, revision: randomRevision() };
}
function withEdit(issue: Issue, values: EditValues): Issue {
  let content = issue.content ?? '';
  content = content.replace(/^#[ \t]+(?:(\d+)[ \t]*:[ \t]*)?.*$/m, (_line, number?: string) => `# ${number ? `${number}: ` : ''}${values.title}`);
  content = patchIssueBody(content, values.body);
  return { ...withStatus({ ...issue, content }, values.status), title: values.title };
}

export function filterIssues(issues: Issue[], workflow: Workflow, filters: Filters) {
  const query = filters.query.trim().toLowerCase();
  const matching = issues.filter((issue) => (!filters.location || issue.location === filters.location) &&
    (!filters.feature || featureKey(issue) === filters.feature) &&
    (!query || issue.title.toLowerCase().includes(query) || (issue.content ?? '').toLowerCase().includes(query)));
  return {
    board: matching.filter((issue) => issue.workflow === workflow && issue.diagnostics.length === 0).sort(compareIssues),
    attention: issues.filter((issue) => issue.diagnostics.length > 0).sort(compareIssues),
  };
}

export type ProtoBoard = ReturnType<typeof useProtoBoard>;

export function useProtoBoard(options: { failWrites: boolean; onReopen: (recovery: Recovery) => void }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [documents, setDocuments] = useState<SupportingDocument[]>([]);
  const [targets, setTargets] = useState<CreationTarget[]>([]);
  const [folder, setFolder] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const latest = useRef(options);
  latest.current = options;

  async function read() {
    const [context, board, docs, creation] = await Promise.all(
      ['/api/context', '/api/issues', '/api/documents', '/api/creation-targets'].map(async (url) => (await fetch(url)).json() as Promise<unknown>));
    setFolder(z.object({ folder: z.string() }).parse(context).folder);
    const parsed = boardSchema.parse(board);
    setIssues(parsed.issues.sort(compareIssues));
    setWarnings(parsed.warnings);
    setDocuments(documentListSchema.parse(docs).documents);
    setTargets(z.array(creationTargetSchema).parse(creation));
    setLoaded(true);
  }
  useEffect(() => {
    void read();
    const source = new EventSource('/api/events');
    source.addEventListener('ready', () => setLive('live'));
    source.addEventListener('change', () => { void read(); });
    source.addEventListener('error', () => setLive('offline'));
    return () => source.close();
  }, []);

  const replace = (id: string, next: Issue | null) =>
    setIssues((current) => (next ? current.map((issue) => issue.id === id ? next : issue) : current.filter((issue) => issue.id !== id)).sort(compareIssues));
  const mark = (id: string, on: boolean) => setPending((current) => {
    const next = new Set(current);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  // Simulated round trip: optimistic state is already on screen; failure rolls it back.
  async function roundTrip(id: string): Promise<boolean> {
    mark(id, true);
    await wait(700);
    mark(id, false);
    return !latest.current.failWrites;
  }
  const label = (issue: Issue) => issue.number ? `#${issue.number}` : issue.title;

  async function moveStatus(id: string, status: string) {
    const before = issues.find((issue) => issue.id === id);
    if (!before || before.status === status) return;
    replace(id, withStatus(before, status));
    if (await roundTrip(id)) return;
    replace(id, before);
    toaster.create({ type: 'error', closable: true, duration: Infinity, title: `${label(before)} stayed in ${before.status}`,
      description: 'The file changed on disk before the move was saved. The board shows the latest file.' });
  }

  async function saveEdit(id: string, baseRevision: string | null, values: EditValues) {
    const before = issues.find((issue) => issue.id === id);
    if (!before) return;
    replace(id, withEdit(before, values));
    if (await roundTrip(id)) { toaster.create({ type: 'success', title: `Saved ${label(before)}` }); return; }
    replace(id, before);
    toaster.create({ type: 'error', closable: true, duration: Infinity, title: `${label(before)} wasn't saved`,
      description: 'Someone else changed this file first. Your changes are kept.',
      action: { label: 'Reopen with my changes', onClick: () => latest.current.onReopen({ issueId: id, baseRevision, values }) } });
  }

  async function addComment(id: string, comment: string): Promise<boolean> {
    const before = issues.find((issue) => issue.id === id);
    if (!before?.content) return false;
    replace(id, { ...before, content: appendIssueComment(before.content, comment), revision: randomRevision() });
    if (await roundTrip(id)) return true;
    replace(id, before);
    toaster.create({ type: 'error', closable: true, duration: Infinity, title: `Comment on ${label(before)} wasn't added`,
      description: 'The file changed on disk first. Your comment is back in the comment box.' });
    return false;
  }

  async function create(target: CreationTarget, values: EditValues) {
    const tempId = `creating:${randomRevision().slice(0, 8)}`;
    const containerPath = target.container === '.' ? '' : `${target.container}/`;
    const draft: Issue = {
      id: tempId, path: `${containerPath}new-issue.md`, location: target.location, feature: target.feature, container: target.container,
      number: null, title: values.title, status: values.status, workflow: target.workflow, type: null, dependencyText: null,
      content: `# ${values.title}\n\nStatus: ${values.status}\n\n${values.body}\n`, revision: null, diagnostics: [],
    };
    setIssues((current) => [...current, draft].sort(compareIssues));
    if (!(await roundTrip(tempId))) {
      replace(tempId, null);
      toaster.create({ type: 'error', closable: true, duration: Infinity, title: `"${values.title}" wasn't created`,
        description: 'The container changed on disk first. Nothing was written.' });
      return;
    }
    setIssues((current) => {
      const numbers = current.filter((issue) => issue.container === target.container && issue.number).map((issue) => Number(issue.number));
      const number = String(Math.max(0, ...numbers) + 1).padStart(2, '0');
      const slug = values.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      const path = `${containerPath}${number}-${slug}.md`;
      const saved: Issue = { ...draft, id: path, path, number, revision: randomRevision(), content: `# ${number}: ${values.title}\n\nStatus: ${values.status}\n\n${values.body}\n` };
      toaster.create({ type: 'success', title: `Created #${number}` });
      return current.map((issue) => issue.id === tempId ? saved : issue).sort(compareIssues);
    });
  }

  // Stands in for an agent rewriting a file while the board is open.
  function simulateAgentEdit(id: string | null) {
    const target = issues.find((issue) => issue.id === id) ?? issues.find((issue) => issue.workflow && issue.content);
    if (!target?.content) return;
    const body = `${bodyOf(target)}\n\n> Agent note: scope narrowed after investigating the parser.`;
    replace(target.id, { ...withEdit(target, { title: `${target.title} (revised)`, status: target.status ?? '', body }) });
    toaster.create({ type: 'info', title: `${label(target)} changed on disk`, description: 'Simulated agent edit.' });
  }

  return { issues, warnings, documents, targets, folder, loaded, live, pending, moveStatus, saveEdit, addComment, create, simulateAgentEdit };
}

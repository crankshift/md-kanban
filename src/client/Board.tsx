import { useEffect, useRef, useState } from 'react';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useLocation, useNavigate } from 'react-router';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { boardKey, diskKey, useDiskQuery } from './ClientState';
import { appendIssueComment, patchIssueBody } from '../server/document.js';
import { boardSchema, issueSchema, compareIssues, implementationStatuses, wayfindingStatuses, type BoardData, type Workflow, type Issue, type IssueCreate } from '../server/board.js';
import { resolveDependencies } from '../server/dependencies.js';
import { DependencyIndicators } from './Dependencies';
import { DocumentList, DocumentPanel, resolveLink, useSupportingDocuments, type DocumentTarget } from './Documents';
import { IssueCreator } from './IssueCreator';
import { IssueDetails } from './IssueDetails';
import { StatusControl, type StatusControls } from './StatusControl';
import type { IssueEditorActions, IssueDraft } from './IssueEditor';

type Filters = { query: string; location: string; feature: string };
const emptyFilters: Filters = { query: '', location: '', feature: '' };
const featureKey = (issue: BoardData['issues'][number]): string => JSON.stringify([issue.location, issue.feature]);

export function BoardView({ data, workflow, filters = emptyFilters, onSelect, onStatusChange, savingId }: StatusControls & {
  data: BoardData; workflow: Workflow; filters?: Filters; onSelect?: (id: string) => void;
}) {
  const draggedId = useRef<string | null>(null);
  const statuses = workflow === 'implementation' ? implementationStatuses : wayfindingStatuses;
  const query = filters.query.trim().toLowerCase();
  const matching = data.issues.filter((issue) => (!filters.location || issue.location === filters.location) &&
    (!filters.feature || featureKey(issue) === filters.feature) &&
    (!query || issue.title.toLowerCase().includes(query) || issue.content?.toLowerCase().includes(query)));
  const issues = matching.filter((issue) => issue.workflow === workflow && issue.diagnostics.length === 0).sort(compareIssues);
  const attention = matching.filter((issue) => issue.diagnostics.length > 0).sort(compareIssues);
  return <>
    <p className="workflow-description">{workflow === 'implementation'
      ? 'Triage status describes readiness; it does not track implementation completion.'
      : 'Wayfinding status describes whether an investigation is open, claimed, or resolved.'}</p>
    {data.warnings.map((warning) => <p role="alert" key={warning}>{warning}</p>)}
    {issues.length === 0 && <p className="empty">{query || filters.location || filters.feature
      ? `No ${workflow} issues match the current search and filters.` : `No ${workflow} issues found in this folder.`}</p>}
    <div className={`board ${workflow}`} aria-label={`${workflow} board`}>
      {statuses.map((status) => {
        const column = issues.filter((issue) => issue.status === status);
        return <section className="column" key={status} aria-labelledby={`column-${status}`}
          onDragOver={(event) => {
            if (draggedId.current && onStatusChange && !savingId) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
          }} onDrop={(event) => {
            if (!draggedId.current || !onStatusChange || savingId) return;
            event.preventDefault();
            onStatusChange(draggedId.current, status);
            draggedId.current = null;
          }}>
          <h2 id={`column-${status}`}>{status} <span className="count">{column.length}</span></h2>
          {column.map((issue) => <article className="card" key={issue.id} onClick={() => onSelect?.(issue.id)}
            draggable={!!onStatusChange && !savingId} onDragStart={(event) => {
              if (!onStatusChange || savingId) { event.preventDefault(); return; }
              draggedId.current = issue.id;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', issue.id);
            }} onDragEnd={() => { draggedId.current = null; }}>
            <p className="issue-number">{issue.number ? `#${issue.number}` : 'Creating…'}</p>
            <h3><button className="card-title" aria-label={issue.number ? `Open #${issue.number}: ${issue.title}` : `Creating: ${issue.title}`} disabled={issue.number === null && issue.id === 'creating'} data-issue-id={issue.id}>{issue.title}</button></h3>
            <p className="feature">{issue.feature}</p>
            <p className="path">{issue.container} · location: {issue.location}</p>
            <DependencyIndicators dependencies={resolveDependencies(issue, data.issues)} />
            <StatusControl issue={issue} onStatusChange={onStatusChange} savingId={savingId} />
          </article>)}
          {column.length === 0 && <p className="muted">No issues</p>}
        </section>;
      })}
    </div>
    <section className="attention" aria-labelledby="attention-heading">
      <h2 id="attention-heading">Needs attention <span className="count">{attention.length}</span></h2>
      {attention.length === 0 && <p className="muted">No issue diagnostics.</p>}
      {attention.map((issue) => <details key={issue.id}>
        <summary>{issue.title} <span className="path">{issue.path}</span></summary>
        <ul>{issue.diagnostics.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        {onSelect && <button onClick={() => onSelect(issue.id)}>Read issue details</button>}
        {issue.content !== null ? <><h3>Original Markdown</h3><pre>{issue.content}</pre></> : <p>Original text is unavailable because the file could not be read.</p>}
      </details>)}
    </section>
  </>;
}

export function Board({ data: initialData, sessionToken }: { data: BoardData; sessionToken?: string | undefined }) {
  const client = useQueryClient();
  const board = useDiskQuery(boardKey, '/api/issues', boardSchema, initialData);
  const data = board.data ?? initialData;
  const [view] = useQueryStates({ workflow: parseAsStringLiteral(['implementation', 'wayfinding']).withDefault('implementation'),
    query: parseAsString.withDefault(''), location: parseAsString.withDefault(''), feature: parseAsString.withDefault(''),
    issue: parseAsString, document: parseAsString, fragment: parseAsString, create: parseAsString }, { history: 'push' });
  function setView(next: Partial<typeof view>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) { if (value === null || value === '') params.delete(key); else params.set(key, value); }
    return navigate({ search: params.toString() }, { state: { from: selectedId ? 'issue' : openDocument ? 'document' : null } });
  }
  const workflow = view.workflow;
  const filters = { query: view.query, location: view.location, feature: view.feature };
  const route = useLocation();
  const panelParams = new URLSearchParams(route.search);
  const selectedId = panelParams.get('issue');
  const creating = panelParams.get('create') === 'true';
  const documentPath = panelParams.get('document');
  const openDocument = documentPath ? { target: { path: documentPath, fragment: panelParams.get('fragment') } } : null;
  const setWorkflow = (workflow: Workflow) => { void setView({ workflow }); };
  const setFilters = (filters: Filters) => { void setView(filters); };
  const setCreating = (value: boolean) => { void setView({ create: value ? 'true' : null, issue: null, document: null }); };
  const [dirty, setDirty] = useState(false);
  const navigate = useNavigate();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty &&
    ['issue', 'document', 'create'].some((key) => new URLSearchParams(currentLocation.search).get(key) !== new URLSearchParams(nextLocation.search).get(key)));
  useEffect(() => { if (blocker.state === 'blocked') {
    if (window.confirm('Discard unsaved changes and close this editor?')) { setDirty(false); blocker.proceed(); }
    else blocker.reset();
  } }, [blocker]);
  const [result, setResult] = useState<{ error: boolean; message: string } | null>(null);
  const [live, setLive] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const supporting = useSupportingDocuments();
  const selected = data.issues.find((issue) => issue.id === selectedId);
  const locations = [...new Set(data.issues.map((issue) => issue.location))].sort();
  const features = [...new Map(data.issues.filter((issue) => !filters.location || issue.location === filters.location)
    .sort(compareIssues).map((issue) => [featureKey(issue), issue])).entries()];
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/events');
    const sync = () => { setLive('live'); void client.invalidateQueries({ queryKey: diskKey }); };
    source.addEventListener('ready', sync); source.addEventListener('change', sync);
    source.addEventListener('error', () => setLive('offline'));
    return () => source.close();
  }, [client]);
  type Write = { base?: Issue; endpoint: 'status' | 'edit' | 'comment' | 'create'; fields: Record<string, unknown>; submitted?: IssueDraft | undefined };
  const mutation = useMutation({ mutationKey: ['write'],
    mutationFn: async ({ base, endpoint, fields }: Write) => {
      if (!sessionToken) throw new Error('Reload the local session before saving.');
      const response = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Md-Kanban-Session': sessionToken },
        body: JSON.stringify(base ? { path: base.path, expectedRevision: base.revision, ...fields } : fields) });
      const value: unknown = await response.json();
      if (!response.ok) throw new Error(typeof value === 'object' && value !== null && 'error' in value ? String(value.error) : 'Save rejected.');
      const saved = issueSchema.parse(value);
      if (!saved.revision || (base && saved.id !== base.id)) throw new Error('Cannot confirm save.');
      return saved;
    },
    onMutate: async (request) => {
      await client.cancelQueries({ queryKey: diskKey });
      const previous = client.getQueryData<BoardData>(boardKey)!;
      const { base, endpoint, fields } = request;
      let optimistic: Issue;
      if (!base) {
        const creation = fields as IssueCreate;
        const sample = previous.issues.find((issue) => issue.container === creation.container)!;
        optimistic = { ...sample, id: 'creating', path: 'creating', number: null, title: creation.title, status: creation.status,
          workflow: creation.workflow, content: creation.body, revision: null, diagnostics: [], dependencyText: null };
      } else {
        optimistic = { ...base };
        if (endpoint === 'status') optimistic.status = String(fields.status);
        if (endpoint === 'comment') optimistic.content = appendIssueComment(base.content!, String(fields.comment));
        if (endpoint === 'edit') {
          const changes = fields.changes as import('../server/board.js').IssueChanges;
          if (changes.title !== undefined) optimistic.title = changes.title;
          if (changes.status !== undefined) optimistic.status = changes.status;
          if (changes.body !== undefined) optimistic.content = patchIssueBody(base.content!, changes.body);
          if (changes.dependencies !== undefined) optimistic.dependencyText = changes.dependencies.map((id) => previous.issues.find((issue) => issue.id === id)?.number).join(', ');
        }
      }
      client.setQueryData<BoardData>(boardKey, { ...previous, issues: base ? previous.issues.map((issue) => issue.id === base.id ? optimistic : issue) : [...previous.issues, optimistic] });
      setResult(null);
      return { previous };
    },
    onError: (error, request, context) => { if (context) client.setQueryData(boardKey, context.previous); setResult({ error: true, message: `${request.endpoint === 'status' ? 'Status was not saved.' : 'Save rejected.'} ${error.message} Could not confirm persistence; review latest Markdown before retrying, especially comments. Your draft is retained while its editor is open.` }); },
    onSuccess: (saved, request) => {
      for (const failed of client.getMutationCache().findAll({ mutationKey: ['write'], status: 'error' })) {
        if (request.submitted && (failed.state.variables as Write | undefined)?.base?.id === saved.id) client.getMutationCache().remove(failed);
      }
      client.setQueryData<BoardData>(boardKey, (current) => ({ ...current!, issues: [...current!.issues.filter((issue) => issue.id !== saved.id && issue.id !== 'creating'), saved].sort(compareIssues) }));
      setResult({ error: false, message: request.endpoint === 'status' ? `#${saved.number}: ${saved.title} status saved as ${saved.status}.` : request.endpoint === 'comment' ? `Comment appended to #${saved.number}.` : `#${saved.number}: ${saved.title} saved.` });
    },
    onSettled: () => { void client.invalidateQueries({ queryKey: diskKey }); },
  });
  const failedWrites = useMutationState({ filters: { mutationKey: ['write'], status: 'error' },
    select: (failed) => ({ mutationId: failed.mutationId, request: failed.state.variables as Write }) }).filter((failed) => failed.request.submitted);
  const recovery = failedWrites.filter((failed) => failed.request.base?.id === selectedId).at(-1)?.request.submitted;
  function discardRecovery() {
    for (const failed of client.getMutationCache().findAll({ mutationKey: ['write'], status: 'error' })) {
      if ((failed.state.variables as Write | undefined)?.base?.id === selectedId) client.getMutationCache().remove(failed);
    }
  }
  const savingId = mutation.isPending ? mutation.variables?.base?.id ?? 'create' : null;
  const reloading = board.isFetching && !mutation.isPending;
  const outdated = board.isError;
  async function reloadForUser() { await client.invalidateQueries({ queryKey: diskKey }, { throwOnError: true }); }
  function write(request: Write) {
    if (client.isMutating({ mutationKey: ['write'] })) return Promise.reject(new Error('Wait for the current save before writing again.'));
    return mutation.mutateAsync(request);
  }
  const writeIssue: IssueEditorActions['onWrite'] = (base, endpoint, fields, submitted) => write({ base, endpoint, fields, submitted });
  async function createNewIssue(request: IssueCreate) {
    const saved = await write({ endpoint: 'create', fields: request });
    setDirty(false);
    void setView({ workflow: saved.workflow!, ...emptyFilters, issue: saved.id, create: null, document: null });
  }
  function selectIssue(id: string) {
    const issue = data.issues.find((candidate) => candidate.id === id) ?? failedWrites.find((failed) => failed.request.base?.id === id)?.request.base;
    if (!issue) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void setView({ issue: id, document: null, fragment: null, create: null, ...(issue.workflow ? { workflow: issue.workflow } : {}) }); setLinkNotice(null);
  }
  function showDocument(target: DocumentTarget) { void setView({ document: target.path, fragment: target.fragment, issue: null, create: null }); setLinkNotice(null); }
  async function followLink(from: string, href: string) {
    const link = await resolveLink(from, href);
    if (link.status === 'unavailable') { setLinkNotice(`Unavailable link “${href}”: ${link.reason}`); return; }
    if (link.issue && data.issues.some((issue) => issue.id === link.path)) selectIssue(link.path);
    else showDocument({ path: link.path, fragment: link.fragment });
  }
  function closeDetails() {
    void setView({ issue: null, document: null, fragment: null }); setLinkNotice(null);
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
  }
  async function changeStatus(id: string, status: string) {
    const issue = data.issues.find((candidate) => candidate.id === id);
    if (!sessionToken || !issue?.revision || issue.status === status || mutation.isPending) return;
    await write({ base: issue, endpoint: 'status', fields: { status } }).catch(() => {});
  }
  const onStatusChange = sessionToken ? (id: string, status: string) => { void changeStatus(id, status); } : undefined;
  return <>
    <div className="workflow-switch" role="group" aria-label="Board workflow">
      <button aria-pressed={workflow === 'implementation'} onClick={() => setWorkflow('implementation')}>Implementation</button>
      <button aria-pressed={workflow === 'wayfinding'} onClick={() => setWorkflow('wayfinding')}>Wayfinding</button>
    </div>
    <div className="filters" role="group" aria-label="Search and filters">
      <label>Search issues<input type="search" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Title or body text" /></label>
      <label>Location<select value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value, feature: '' })}>
        <option value="">All locations</option>
        {locations.map((location) => <option key={location} value={location}>{location}</option>)}
      </select></label>
      <label>Feature / effort<select value={filters.feature} onChange={(event) => setFilters({ ...filters, feature: event.target.value })}>
        <option value="">All features / efforts</option>
        {features.map(([key, issue]) => <option key={key} value={key}>{issue.feature} · {issue.location}</option>)}
      </select></label>
      <button onClick={() => setFilters(emptyFilters)}>Clear search and filters</button>
    </div>
    {sessionToken && <>
      <button disabled={!!savingId || reloading} onClick={() => setCreating(true)}>New issue</button>
      {creating && <IssueCreator visible={creating} onDirty={setDirty} issues={data.issues} saving={!!savingId || reloading} onClose={() => setCreating(false)} onCreate={createNewIssue} onReload={reloadForUser} />}
    </>}
    {sessionToken && <p className="muted">Drag a card to another column or use Change status. Status changes save immediately; dependencies are advisory.</p>}
    {result && <p role={result.error ? 'alert' : 'status'}>{result.message}</p>}
    {live === 'live' && <p className="muted live-status">Live: changes made outside the app refresh automatically. Unsaved drafts are kept.</p>}
    {(outdated || live === 'offline') && <p role="alert">{outdated
      ? 'Could not read the latest issues from disk; the board may be outdated. Your drafts are retained.'
      : 'Live updates are disconnected, so changes made outside the app may not appear. Reconnecting automatically; use Reload issues to read the latest files now.'}
      <button disabled={!!savingId || reloading} onClick={() => { void reloadForUser().catch(() => {}); }}>Reload issues</button></p>}
    {failedWrites.filter((failed) => failed.request.base?.id !== selectedId).map((failed) => <button key={failed.mutationId} onClick={() => selectIssue(failed.request.base!.id)}>Reopen editor with submitted changes</button>)}
    {savingId && <p role="status">Saving issue…</p>}
    <DocumentList documents={supporting.documents} failed={supporting.failed} onOpen={(path) => showDocument({ path, fragment: null })} />
    <div className={selected || openDocument ? 'board-layout has-details' : 'board-layout'} aria-busy={!!savingId || reloading}>
      <div className="board-content"><BoardView data={data} workflow={workflow} filters={filters} onSelect={selectIssue} onStatusChange={onStatusChange} savingId={savingId ?? (reloading ? 'reload' : null)} /></div>
      {openDocument && <DocumentPanel target={openDocument.target} notice={linkNotice} onClose={closeDetails}
        onLink={(from, href) => { void followLink(from, href); }}
        onBack={route.state?.from ? () => { void navigate(-1); } : undefined} backLabel={route.state?.from === 'issue' ? 'Back to issue' : 'Back to previous document'} />}
      {selectedId && <IssueDetails key={selectedId} id={selectedId} issue={selected ?? (recovery ? { ...recovery.base, content: null, revision: null, diagnostics: ['The file is unavailable. Copy your submitted changes before closing.'] } : undefined)} issues={data.issues} onSelect={selectIssue} onClose={closeDetails}
        notice={linkNotice} onLink={(from, href) => { void followLink(from, href); }} onStatusChange={onStatusChange} savingId={savingId ?? (reloading ? 'reload' : null)}
        editor={sessionToken ? { onDirty: setDirty, recovery, onDiscardRecovery: discardRecovery, onWrite: writeIssue, onReload: reloadForUser } : undefined} />}
    </div>
  </>;
}

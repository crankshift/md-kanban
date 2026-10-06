import { useEffect, useRef, useState } from 'react';
import { boardSchema, issueSchema, compareIssues, implementationStatuses, wayfindingStatuses, type BoardData, type Workflow, type Issue, type IssueCreate } from '../server/board.js';
import { resolveDependencies } from '../server/dependencies.js';
import { DependencyIndicators } from './Dependencies';
import { DocumentList, DocumentPanel, resolveLink, useSupportingDocuments, type DocumentTarget } from './Documents';
import { IssueCreator } from './IssueCreator';
import { IssueDetails, MissingIssue } from './IssueDetails';
import { StatusControl, type StatusControls } from './StatusControl';
import type { IssueEditorActions, IssueDraft } from './IssueEditor';

type Filters = { query: string; location: string; feature: string };
const emptyFilters: Filters = { query: '', location: '', feature: '' };
const featureKey = (issue: BoardData['issues'][number]): string => JSON.stringify([issue.location, issue.feature]);

// Keep unchanged issue objects (and the whole board, when nothing changed) so a refresh only
// touches what actually changed on disk.
function mergeBoards(current: BoardData, next: BoardData): BoardData {
  const known = new Map(current.issues.map((issue) => [issue.id, issue]));
  const issues = next.issues.map((issue) => {
    const previous = known.get(issue.id);
    return previous && JSON.stringify(previous) === JSON.stringify(issue) ? previous : issue;
  });
  const same = issues.length === current.issues.length && issues.every((issue, index) => issue === current.issues[index]) &&
    JSON.stringify(current.warnings) === JSON.stringify(next.warnings);
  return same ? current : { issues, warnings: next.warnings };
}

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
            <p className="issue-number">#{issue.number}</p>
            <h3><button className="card-title" aria-label={`Open #${issue.number}: ${issue.title}`} data-issue-id={issue.id}>{issue.title}</button></h3>
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
  const [data, setData] = useState(initialData);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [result, setResult] = useState<{ error: boolean; message: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, IssueDraft>>({});
  const saving = useRef(false);
  const localWrites = useRef(0);
  const refreshing = useRef(false);
  const refreshQueued = useRef(false);
  const boardRequests = useRef(0);
  const [live, setLive] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [outdated, setOutdated] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>('implementation');
  const [filters, setFilters] = useState(emptyFilters);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // The side panel shows one thing at a time. Following a link remembers where it came from so Back returns there.
  type Origin = { issueId: string } | { document: DocumentTarget; origin: Origin | null };
  const [openDocument, setOpenDocument] = useState<{ target: DocumentTarget; origin: Origin | null } | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const supporting = useSupportingDocuments(data);
  const selected = data.issues.find((issue) => issue.id === selectedId);
  const locations = [...new Set(data.issues.map((issue) => issue.location))].sort();
  const features = [...new Map(data.issues.filter((issue) => !filters.location || issue.location === filters.location)
    .sort(compareIssues).map((issue) => [featureKey(issue), issue])).entries()];
  useEffect(() => {
    if (!Object.keys(drafts).length) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [drafts]);
  const refresh = useRef<() => Promise<void>>(async () => {});
  refresh.current = refreshExternal;
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/events');
    // Opening (or reopening) the stream also catches anything changed while disconnected.
    const sync = () => { setLive('live'); void refresh.current(); };
    source.addEventListener('ready', sync);
    source.addEventListener('change', () => { void refresh.current(); });
    source.addEventListener('error', () => setLive('offline'));
    return () => source.close();
  }, []);
  function retainDraft(id: string, draft: IssueDraft | undefined) {
    setDrafts((current) => {
      const updated = { ...current };
      if (draft) updated[id] = draft;
      else delete updated[id];
      return updated;
    });
  }
  // Responses can arrive out of order; only the most recently requested board may be applied.
  async function readBoard(): Promise<{ board: BoardData; latest: boolean }> {
    const request = ++boardRequests.current;
    const response = await fetch('/api/issues');
    if (!response.ok) throw new Error('Could not reload issues. Your drafts are retained; check the local server.');
    const board = boardSchema.parse(await response.json());
    return { board, latest: request === boardRequests.current };
  }
  async function reloadIssues() {
    setReloading(true);
    try {
      const { board, latest } = await readBoard();
      if (latest) { setData((current) => mergeBoards(current, board)); setOutdated(false); }
    } finally { setReloading(false); }
  }
  // Background refresh for changes made outside the app. It never touches drafts, filters, the workflow,
  // or the selection, and it yields to in-flight saves so a late response cannot show an unsaved state.
  async function refreshExternal() {
    if (saving.current || refreshing.current) { refreshQueued.current = true; return; }
    refreshing.current = true;
    try {
      do {
        refreshQueued.current = false;
        const writes = localWrites.current;
        try {
          const { board, latest } = await readBoard();
          if (!latest) continue; // A newer request owns the result.
          if (saving.current || writes !== localWrites.current) { refreshQueued.current = true; continue; }
          setData((current) => mergeBoards(current, board));
          setOutdated(false);
        } catch { setOutdated(true); }
      } while (refreshQueued.current && !saving.current);
    } finally { refreshing.current = false; }
  }
  function finishSave() {
    saving.current = false;
    setSavingId(null);
    if (refreshQueued.current) void refresh.current();
  }
  async function createNewIssue(request: IssueCreate) {
    if (!sessionToken || saving.current) throw new Error('Wait for the current save or reload the local session. Draft retained.');
    saving.current = true; localWrites.current += 1; setSavingId('create'); setResult(null);
    try {
      const response = await fetch('/api/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Md-Kanban-Session': sessionToken },
        body: JSON.stringify(request),
      });
      const value: unknown = await response.json();
      if (!response.ok) throw new Error(typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string' ? value.error : 'Creation rejected.');
      const saved = issueSchema.parse(value);
      if (!saved.revision || saved.workflow !== request.workflow || saved.container !== request.container || saved.title !== request.title || saved.status !== request.status) throw new Error('Cannot confirm creation.');
      setData((current) => ({ ...current, issues: [...current.issues.filter((issue) => issue.id !== saved.id), saved].sort(compareIssues) }));
      setWorkflow(saved.workflow); setFilters(emptyFilters); setSelectedId(saved.id);
      setResult({ error: false, message: `#${saved.number}: ${saved.title} created.` });
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Could not confirm creation.';
      try { await reloadIssues(); message += ' Latest issues loaded.'; }
      catch { message += ' Reload failed; displayed issues may be outdated.'; }
      message += ' Draft retained. Inspect the board for a saved issue before reloading containers and retrying.';
      setResult({ error: true, message }); throw new Error(message);
    } finally { finishSave(); }
  }
  async function persistIssue(base: Issue, endpoint: 'status' | 'edit' | 'comment', fields: Parameters<IssueEditorActions['onWrite']>[2] | { status: string }) {
    const statusMove = endpoint === 'status';
    const rejection = statusMove ? 'Status was not saved.' : 'Save rejected.';
    if (!sessionToken || !base.revision || saving.current) throw new Error('Wait for the current save or reload the local session. Your draft is retained.');
    saving.current = true;
    localWrites.current += 1;
    setSavingId(base.id);
    setResult(null);
    try {
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Md-Kanban-Session': sessionToken },
        body: JSON.stringify({ path: base.path, expectedRevision: base.revision, ...fields }),
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        const detail = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string' ? value.error : 'Check the local server and reload issues.';
        throw new Error(`${rejection} ${detail}`);
      }
      const saved = issueSchema.parse(value);
      if (saved.id !== base.id || !saved.revision || ('status' in fields && saved.status !== fields.status)) throw new Error('Cannot confirm save.');
      setData((current) => ({ ...current, issues: current.issues.map((candidate) => candidate.id === saved.id ? saved : candidate) }));
      setResult({ error: false, message: statusMove ? `#${base.number}: ${base.title} status saved as ${saved.status}.` : endpoint === 'comment' ? `Comment appended to #${saved.number}.` : `#${saved.number}: ${saved.title} saved.` });
      return saved;
    } catch (error) {
      let message = error instanceof Error && error.message.startsWith(rejection) ? error.message : statusMove
        ? 'Could not confirm the status save. Check the local server and reload issues before retrying.'
        : 'Could not confirm the save. Check the latest Markdown before retrying, especially comments.';
      // A lost response can follow a successful write. Preserve drafts while reading disk.
      try { await reloadIssues(); message += statusMove ? ' Latest issues loaded; review them before retrying.' : ' Latest issues loaded; your draft is retained for review and recovery.'; }
      catch { message += statusMove ? ' Could not refresh issues; displayed statuses may be outdated. Reload the page.' : ' Reload failed; displayed data may be outdated. Your draft is retained. Reconnect and use Reload issues, keep draft.'; }
      setResult({ error: true, message });
      throw new Error(message);
    } finally { finishSave(); }
  }
  const writeIssue: IssueEditorActions['onWrite'] = persistIssue;
  async function reloadForUser() {
    try { await reloadIssues(); setResult({ error: false, message: 'Latest issues loaded; drafts retained.' }); }
    catch {
      const message = 'Could not reload issues. Your drafts are retained; check the local server.';
      setResult({ error: true, message });
      throw new Error(message);
    }
  }
  function selectIssue(id: string) {
    const issue = data.issues.find((candidate) => candidate.id === id);
    if (!issue) return;
    if (selectedId === null) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCreating(false); setSelectedId(id); setOpenDocument(null); setLinkNotice(null);
    if (issue.workflow) setWorkflow(issue.workflow);
  }
  function showDocument(target: DocumentTarget, origin: Origin | null) {
    if (selectedId === null && !openDocument) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCreating(false); setSelectedId(null); setLinkNotice(null);
    setOpenDocument({ target, origin });
  }
  async function followLink(from: string, href: string, origin: Origin) {
    const link = await resolveLink(from, href);
    if (link.status === 'unavailable') { setLinkNotice(`Unavailable link “${href}”: ${link.reason}`); return; }
    if (link.issue && data.issues.some((issue) => issue.id === link.path)) { setOpenDocument(null); setLinkNotice(null); selectIssue(link.path); return; }
    showDocument({ path: link.path, fragment: link.fragment }, origin);
  }
  function goBack(origin: Origin) {
    setLinkNotice(null);
    if ('issueId' in origin) { setOpenDocument(null); selectIssue(origin.issueId); }
    else setOpenDocument({ target: origin.document, origin: origin.origin });
  }
  function closeDetails() {
    setOpenDocument(null); setLinkNotice(null);
    setSelectedId(null);
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
  }
  async function changeStatus(id: string, status: string) {
    const issue = data.issues.find((candidate) => candidate.id === id);
    if (!sessionToken || !issue?.revision || issue.status === status || saving.current) return;
    await persistIssue(issue, 'status', { status }).catch(() => {}); // Failure is already visible above.
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
      <button disabled={!!savingId || reloading} onClick={() => { setCreating(true); setSelectedId(null); setOpenDocument(null); }}>New issue</button>
      <IssueCreator visible={creating} issues={data.issues} saving={!!savingId || reloading} onClose={() => setCreating(false)} onCreate={createNewIssue} onReload={reloadForUser} />
    </>}
    {sessionToken && <p className="muted">Drag a card to another column or use Change status. Status changes save immediately; dependencies are advisory.</p>}
    {result && <p role={result.error ? 'alert' : 'status'}>{result.message}</p>}
    {live === 'live' && <p className="muted live-status">Live: changes made outside the app refresh automatically. Unsaved drafts are kept.</p>}
    {(outdated || live === 'offline') && <p role="alert">{outdated
      ? 'Could not read the latest issues from disk; the board may be outdated. Your drafts are retained.'
      : 'Live updates are disconnected, so changes made outside the app may not appear. Reconnecting automatically; use Reload issues to read the latest files now.'}
      <button disabled={!!savingId || reloading} onClick={() => { void reloadForUser().catch(() => {}); }}>Reload issues</button></p>}
    {Object.keys(drafts).length > 0 && <div className="draft-list"><p>Drafts retained in this tab. Save or copy them before leaving the page.</p>
      <button disabled={!!savingId || reloading} onClick={() => { void reloadForUser().catch(() => {}); }}>Reload issues, keep drafts</button>
      {Object.entries(drafts).map(([id, draft]) => {
        const issue = data.issues.find((candidate) => candidate.id === id);
        if (!issue) return <details key={id}><summary>Unavailable issue draft: {id}</summary>
          <p role="alert">The file was removed, renamed, or moved outside the app. Copy the draft below before discarding it.</p>
          <pre>{JSON.stringify(draft.values, null, 2)}</pre></details>;
        const conflict = issue.diagnostics.length > 0 ? 'The file now needs attention.' : issue.revision !== draft.base.revision ? 'The file changed outside the app.' : null;
        return <span key={id}><button onClick={() => selectIssue(id)}>Draft #{draft.base.number}: {draft.base.title}</button>
          {conflict && <span role="alert" className="conflict"> {conflict} Open the draft to review or recover it; saving the old version will be rejected.</span>}</span>;
      })}
    </div>}
    {savingId && <p role="status">Saving issue…</p>}
    <DocumentList documents={supporting.documents} failed={supporting.failed} onOpen={(path) => showDocument({ path, fragment: null }, null)} />
    <div className={selected || openDocument ? 'board-layout has-details' : 'board-layout'} aria-busy={!!savingId || reloading}>
      <div className="board-content"><BoardView data={data} workflow={workflow} filters={filters} onSelect={selectIssue} onStatusChange={onStatusChange} savingId={savingId ?? (reloading ? 'reload' : null)} /></div>
      {!selected && selectedId && <MissingIssue id={selectedId} draft={drafts[selectedId]} onClose={closeDetails}
        onDiscard={() => { retainDraft(selectedId, undefined); closeDetails(); }} />}
      {openDocument && <DocumentPanel target={openDocument.target} notice={linkNotice} onClose={closeDetails}
        onLink={(from, href) => { void followLink(from, href, { document: openDocument.target, origin: openDocument.origin }); }}
        onBack={openDocument.origin ? () => goBack(openDocument.origin!) : undefined}
        backLabel={openDocument.origin && 'issueId' in openDocument.origin ? 'Back to issue' : 'Back to previous document'} />}
      {selected && <IssueDetails issue={selected} issues={data.issues} onSelect={selectIssue} onClose={closeDetails}
        notice={linkNotice} onLink={(from, href) => { void followLink(from, href, { issueId: selected.id }); }} onStatusChange={onStatusChange} savingId={savingId ?? (reloading ? 'reload' : null)}
        editor={sessionToken ? { draft: drafts[selected.id], onDraft: (draft) => retainDraft(selected.id, draft), onWrite: writeIssue, onReload: reloadForUser } : undefined} />}
    </div>
  </>;
}

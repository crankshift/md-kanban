import { useRef, useState } from 'react';
import { boardSchema, issueSchema, compareIssues, implementationStatuses, wayfindingStatuses, type BoardData, type Workflow } from '../server/board.js';
import { resolveDependencies } from '../server/dependencies.js';
import { DependencyIndicators } from './Dependencies';
import { IssueDetails } from './IssueDetails';
import { StatusControl, type StatusControls } from './StatusControl';

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
  const [result, setResult] = useState<{ error: boolean; message: string } | null>(null);
  const saving = useRef(false);
  const [workflow, setWorkflow] = useState<Workflow>('implementation');
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selected = data.issues.find((issue) => issue.id === selectedId);
  const locations = [...new Set(data.issues.map((issue) => issue.location))].sort();
  const features = [...new Map(data.issues.filter((issue) => !filters.location || issue.location === filters.location)
    .sort(compareIssues).map((issue) => [featureKey(issue), issue])).entries()];
  function selectIssue(id: string) {
    const issue = data.issues.find((candidate) => candidate.id === id);
    if (!issue) return;
    if (selectedId === null) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id);
    if (issue.workflow) setWorkflow(issue.workflow);
  }
  function closeDetails() {
    setSelectedId(null);
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
  }
  async function changeStatus(id: string, status: string) {
    const issue = data.issues.find((candidate) => candidate.id === id);
    if (!sessionToken || !issue?.revision || issue.status === status || saving.current) return;
    saving.current = true;
    setSavingId(id);
    setResult(null);
    try {
      const response = await fetch('/api/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Md-Kanban-Session': sessionToken },
        body: JSON.stringify({ path: issue.path, expectedRevision: issue.revision, status }),
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        const message = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
          ? value.error : 'Check folder access and the local server, then reload issues before retrying.';
        throw new Error(`Status was not saved. ${message}`);
      }
      const saved = issueSchema.parse(value);
      if (saved.id !== id || saved.status !== status || !saved.revision) throw new Error('Could not confirm the saved status. Reload issues before retrying.');
      setData((current) => ({ ...current, issues: current.issues.map((candidate) => candidate.id === id ? saved : candidate) }));
      setResult({ error: false, message: `#${issue.number}: ${issue.title} status saved as ${saved.status}.` });
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('Status was not saved.') ? error.message
        : 'Could not confirm the status save. Check the local server and reload issues before retrying.';
      // A lost response can follow a successful write. Read disk before allowing another attempt.
      try {
        const response = await fetch('/api/issues');
        if (!response.ok) throw new Error('Refresh failed');
        setData(boardSchema.parse(await response.json()));
        setResult({ error: true, message: `${message} Latest issues loaded; review them before retrying.` });
      } catch {
        setResult({ error: true, message: `${message} Could not refresh issues; displayed statuses may be outdated. Reload the page.` });
      }
    } finally {
      saving.current = false;
      setSavingId(null);
    }
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
    {sessionToken && <p className="muted">Drag a card to another column or use Change status. Status changes save immediately; dependencies are advisory.</p>}
    {result && <p role={result.error ? 'alert' : 'status'}>{result.message}</p>}
    {savingId && <p role="status">Saving status…</p>}
    <div className={selected ? 'board-layout has-details' : 'board-layout'} aria-busy={!!savingId}>
      <div className="board-content"><BoardView data={data} workflow={workflow} filters={filters} onSelect={selectIssue} onStatusChange={onStatusChange} savingId={savingId} /></div>
      {selected && <IssueDetails issue={selected} issues={data.issues} onSelect={selectIssue} onClose={closeDetails} onStatusChange={onStatusChange} savingId={savingId} />}
    </div>
  </>;
}

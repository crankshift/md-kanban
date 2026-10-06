import { useRef, useState } from 'react';
import { compareIssues, implementationStatuses, wayfindingStatuses, type BoardData, type Workflow } from '../server/board.js';
import { resolveDependencies } from '../server/dependencies.js';
import { DependencyIndicators } from './Dependencies';
import { IssueDetails } from './IssueDetails';

type Filters = { query: string; location: string; feature: string };
const emptyFilters: Filters = { query: '', location: '', feature: '' };
const featureKey = (issue: BoardData['issues'][number]): string => JSON.stringify([issue.location, issue.feature]);

export function BoardView({ data, workflow, filters = emptyFilters, onSelect }: {
  data: BoardData; workflow: Workflow; filters?: Filters; onSelect?: (id: string) => void;
}) {
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
        return <section className="column" key={status} aria-labelledby={`column-${status}`}>
          <h2 id={`column-${status}`}>{status} <span className="count">{column.length}</span></h2>
          {column.map((issue) => <article className="card" key={issue.id} onClick={() => onSelect?.(issue.id)}>
            <p className="issue-number">#{issue.number}</p>
            <h3><button className="card-title" aria-label={`Open #${issue.number}: ${issue.title}`} data-issue-id={issue.id}>{issue.title}</button></h3>
            <p className="feature">{issue.feature}</p>
            <p className="path">{issue.container} · location: {issue.location}</p>
            <DependencyIndicators dependencies={resolveDependencies(issue, data.issues)} />
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

export function Board({ data }: { data: BoardData }) {
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
    <div className={selected ? 'board-layout has-details' : 'board-layout'}>
      <div className="board-content"><BoardView data={data} workflow={workflow} filters={filters} onSelect={selectIssue} /></div>
      {selected && <IssueDetails issue={selected} issues={data.issues} onSelect={selectIssue} onClose={closeDetails} />}
    </div>
  </>;
}

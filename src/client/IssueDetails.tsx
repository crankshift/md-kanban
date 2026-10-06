import { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Issue } from '../server/board.js';
import { DependencyList } from './Dependencies';
import { StatusControl, type StatusControls } from './StatusControl';

export function IssueDetails({ issue, issues, onSelect, onClose, onStatusChange, savingId }: StatusControls & {
  issue: Issue; issues: Issue[]; onSelect: (id: string) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); panel.current?.scrollTo?.(0, 0); }, [issue.id]);
  return <aside className="issue-details" aria-label="Issue details" tabIndex={-1} ref={panel}
    onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <div className="details-header">
      <h2>#{issue.number}: {issue.title}</h2>
      <button onClick={onClose} aria-label="Close issue details">Close</button>
    </div>
    <dl className="issue-context">
      <dt>Status</dt><dd>{issue.status ?? 'Unavailable'} · {issue.workflow ?? 'Needs attention'}</dd>
      <dt>Feature / effort</dt><dd>{issue.feature}</dd>
      <dt>Location</dt><dd className="path">{issue.location}</dd>
      <dt>File</dt><dd className="path">{issue.path}</dd>
    </dl>
    <StatusControl issue={issue} onStatusChange={onStatusChange} savingId={savingId} />
    {issue.diagnostics.length > 0 && <ul role="alert">{issue.diagnostics.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    <DependencyList issue={issue} issues={issues} onSelect={onSelect} />
    <section className="markdown" aria-label="Issue Markdown and comments">
      {issue.content === null ? <p>Original text is unavailable because the file could not be read.</p> :
        <Markdown skipHtml remarkPlugins={[remarkGfm]} components={{ h1: 'h3' }}>{issue.content}</Markdown>}
    </section>
  </aside>;
}

import { useEffect, useRef } from 'react';
import { SafeMarkdown } from './SafeMarkdown';
import { IssueEditor, type IssueDraft, type IssueEditorActions } from './IssueEditor';
import type { Issue } from '../server/board.js';
import { DependencyList } from './Dependencies';
import { StatusControl, type StatusControls } from './StatusControl';

export function IssueDetails({ issue, issues, onSelect, onClose, onStatusChange, savingId, editor }: StatusControls & {
  issue: Issue; issues: Issue[]; onSelect: (id: string) => void; onClose: () => void;
  editor?: IssueEditorActions | undefined;
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
    {editor && <IssueEditor key={issue.id} issue={issue} issues={issues} saving={!!savingId} {...editor} />}
    <section className="markdown" aria-label="Issue Markdown and comments">
      {issue.content === null ? <p>Original text is unavailable because the file could not be read.</p> :
        <SafeMarkdown>{issue.content}</SafeMarkdown>}
    </section>
  </aside>;
}

// Shown while the open issue's file is absent. It stays open so the issue returns in place if the file reappears,
// for example after a delete-and-recreate by another tool.
export function MissingIssue({ id, draft, onClose, onDiscard }: { id: string; draft: IssueDraft | undefined; onClose: () => void; onDiscard: () => void }) {
  return <aside className="issue-details" aria-label="Issue details" tabIndex={-1} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <div className="details-header">
      <h2>{draft ? `#${draft.base.number}: ${draft.base.title}` : 'Issue unavailable'}</h2>
      <button onClick={onClose} aria-label="Close issue details">Close</button>
    </div>
    <p role="alert">The file <span className="path">{id}</span> was removed, renamed, or moved outside the app.
      {draft ? ' Your unsaved draft is retained below; copy it before discarding. If the file was renamed, find the new file on the board and apply the changes there.'
        : ' If it reappears, this panel shows it again; if it was renamed, find the new file on the board.'}</p>
    {draft && <>
      <textarea aria-label="Recoverable draft of removed issue" readOnly rows={14} value={JSON.stringify(draft.values, null, 2)} />
      <button onClick={onDiscard}>Discard draft</button></>}
  </aside>;
}

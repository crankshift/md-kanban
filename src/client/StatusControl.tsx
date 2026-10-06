import { implementationStatuses, wayfindingStatuses, type Issue } from '../server/board.js';

export type StatusControls = {
  onStatusChange?: ((id: string, status: string) => void) | undefined;
  savingId?: string | null | undefined;
};

export function StatusControl({ issue, onStatusChange, savingId }: StatusControls & { issue: Issue }) {
  if (!onStatusChange || !issue.workflow) return null;
  const statuses = issue.workflow === 'implementation' ? implementationStatuses : wayfindingStatuses;
  return <label className="status-control" onClick={(event) => event.stopPropagation()}>
    Change status
    <select aria-label={`Status for #${issue.number}: ${issue.title} · ${issue.path}`} value={issue.status ?? ''}
      disabled={!!savingId} onChange={(event) => onStatusChange(issue.id, event.target.value)}>
      {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
    </select>
  </label>;
}

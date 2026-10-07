import { Picker, choices } from './Picker';
import { implementationStatuses, wayfindingStatuses, type Issue } from '../server/board.js';

export type StatusControls = {
  onStatusChange?: ((id: string, status: string, base?: Issue) => void) | undefined;
  savingId?: string | null | undefined;
};

export function StatusControl({
  issue,
  onStatusChange,
  savingId,
}: StatusControls & { issue: Issue }) {
  if (!onStatusChange || !issue.workflow || issue.diagnostics.length > 0) return null;
  const statuses =
    issue.workflow === 'implementation' ? implementationStatuses : wayfindingStatuses;
  const label = `Status for #${issue.number}: ${issue.title} · ${issue.path}`;
  return (
    <Picker
      hideLabel
      label={label}
      items={choices(statuses)}
      value={[issue.status ?? '']}
      disabled={!!savingId}
      onChange={(values) => {
        if (values[0]) onStatusChange(issue.id, values[0]);
      }}
    />
  );
}

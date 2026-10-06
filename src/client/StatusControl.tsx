import { IconButton, Popover } from '@chakra-ui/react';
import { LuEllipsis } from 'react-icons/lu';
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
  compact = false,
}: StatusControls & { issue: Issue; compact?: boolean }) {
  if (!onStatusChange || !issue.workflow || issue.diagnostics.length > 0) return null;
  const statuses =
    issue.workflow === 'implementation' ? implementationStatuses : wayfindingStatuses;
  const label = `Status for #${issue.number}: ${issue.title} · ${issue.path}`;
  const picker = (
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
  if (!compact) return picker;
  return (
    <Popover.Root positioning={{ placement: 'bottom-end' }}>
      <Popover.Trigger asChild>
        <IconButton
          aria-label={label}
          size="xs"
          variant="ghost"
          color="fg.muted"
          disabled={!!savingId}
        >
          <LuEllipsis />
        </IconButton>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content w="72">
          <Popover.Body>
            <Popover.Title mb="2" fontSize="sm">
              Change status
            </Popover.Title>
            {picker}
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
}

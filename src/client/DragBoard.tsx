import { Box } from '@chakra-ui/react';
import { DragDropProvider, KeyboardSensor, PointerSensor, useDraggable, useDroppable } from '@dnd-kit/react';
import {
  Accessibility,
  PointerActivationConstraints,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/dom';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Issue, Workflow } from '../server/board.js';
import type { StatusControls } from './StatusControl';

const issueName = (issue: Issue | undefined) =>
  issue ? `#${issue.number}: ${issue.title}` : 'Issue';
const sensors = [
  PointerSensor.configure({
    preventActivation: (event, source) =>
      !!source.data.dragDisabled || (PointerSensor.defaults.preventActivation?.(event, source) ?? false),
    activationConstraints: (event) => event.pointerType === 'touch'
      ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: 8 })]
      : [new PointerActivationConstraints.Distance({ value: 6 })],
  }),
  KeyboardSensor.configure({
    preventActivation: (event, source) =>
      !!source.data.dragDisabled || KeyboardSensor.defaults.preventActivation(event, source),
    keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] },
  }),
];
const accessibility = Accessibility.configure({
  screenReaderInstructions: {
    draggable:
      'Enter opens issue details. Press Space to pick up this issue. Use arrow keys to move to another status column; Shift plus an arrow moves faster. Press Space or Enter to drop, or Escape to cancel. The status picker in issue details is also available.',
  },
  debounce: 150,
  announcements: {
    dragstart: ({ operation }: DragStartEvent) =>
      `Picked up ${issueName(operation.source?.data.issue)}.`,
    dragover: ({ operation }: DragOverEvent) =>
      operation.target
        ? `${issueName(operation.source?.data.issue)} over ${operation.target.data.status}.`
        : 'Outside the status columns.',
    dragend: ({ canceled, operation }: DragEndEvent) =>
      canceled
        ? 'Dragging cancelled. Status unchanged.'
        : !operation.target || operation.target.data.status === operation.source?.data.issue?.status
          ? 'Status unchanged.'
          : `Dropped ${issueName(operation.source?.data.issue)} on ${operation.target.data.status}. Saving status.`,
  },
});

export function StatusDragBoard({
  children,
  workflow,
  onStatusChange,
  savingId,
}: StatusControls & {
  children: ReactNode;
  workflow: Workflow;
}) {
  const snapshot = useRef<Issue | null>(null);
  const focusId = useRef<string | null>(null);
  // A move remounts the card in another column. Keep the keyboard user's place.
  useEffect(() => {
    if (!focusId.current) return;
    const card = document.getElementById(`drag-${focusId.current}`);
    if (card && card.getAttribute('data-drag-disabled') !== 'true') {
      card.focus();
      focusId.current = null;
    }
  });
  return (
    <DragDropProvider
      key={workflow}
      sensors={sensors}
      plugins={(defaults) =>
        defaults.map((plugin) => (plugin === Accessibility ? accessibility : plugin))
      }
      onBeforeDragStart={(event) => {
        if (savingId || !onStatusChange) {
          snapshot.current = null;
          event.preventDefault();
        } else snapshot.current = event.operation.source?.data.issue ?? null;
      }}
      onDragEnd={({ canceled, operation, nativeEvent }) => {
        const base = snapshot.current;
        snapshot.current = null;
        if (!base) return;
        if (nativeEvent instanceof KeyboardEvent) focusId.current = base.id;
        const status = operation.target?.data.status;
        if (
          !canceled &&
          !savingId &&
          status &&
          status !== base.status &&
          base.workflow === workflow
        )
          onStatusChange?.(base.id, status, base);
      }}
    >
      {children}
    </DragDropProvider>
  );
}

export function DragCard({
  issue,
  disabled,
  draggable,
  onSelect,
  children,
}: {
  issue: Issue;
  disabled: boolean;
  draggable: boolean;
  onSelect?: ((id: string) => void) | undefined;
  children: ReactNode;
}) {
  const { ref, isDragging } = useDraggable({
    id: issue.id,
    type: issue.workflow ?? '',
    // Drag availability is separate from opening readable issue details.
    data: { issue, dragDisabled: disabled },
    disabled: !draggable || issue.id === 'creating',
  });
  return (
    <Box
      as="article"
      ref={draggable ? ref : undefined}
      id={`drag-${issue.id}`}
      role="button"
      tabIndex={issue.id === 'creating' ? -1 : 0}
      aria-label={issue.number ? `Open #${issue.number}: ${issue.title} · ${issue.path}` : `Creating: ${issue.title}`}
      aria-disabled={issue.id === 'creating' || undefined}
      data-drag-disabled={disabled || !draggable || undefined}
      aria-roledescription={draggable ? 'draggable issue' : undefined}
      minW="0"
      bg="bg.panel"
      borderWidth="1px"
      rounded="l2"
      p="3"
      cursor={disabled ? 'default' : draggable ? 'grab' : 'pointer'}
      touchAction={draggable ? 'none' : undefined}
      _hover={{ bg: 'bg.emphasized' }}
      _focusVisible={{ outline: '2px solid', outlineColor: 'colorPalette.focusRing', outlineOffset: '2px' }}
      onClick={(event) => {
        if (!event.defaultPrevented && !isDragging && issue.id !== 'creating') onSelect?.(issue.id);
      }}
      onKeyDown={(event) => {
        if (!event.defaultPrevented && !isDragging && issue.id !== 'creating' &&
          (event.key === 'Enter' || (!draggable && event.key === ' '))) {
          event.preventDefault();
          onSelect?.(issue.id);
        }
      }}
    >
      {children}
    </Box>
  );
}

export function StatusDropColumn({
  status,
  workflow,
  children,
}: {
  status: string;
  workflow: Workflow;
  children: ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `status-${workflow}-${status}`,
    accept: workflow,
    data: { status },
  });
  return (
    <Box
      as="section"
      ref={ref}
      aria-label={status}
      bg={isDropTarget ? 'bg.emphasized' : 'bg.muted'}
      outline={isDropTarget ? '2px solid' : undefined}
      outlineColor="border.emphasized"
      rounded="l2"
      p="2"
      minH="40"
    >
      {children}
    </Box>
  );
}

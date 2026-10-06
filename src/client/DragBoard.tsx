import { Box, IconButton } from '@chakra-ui/react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import {
  Accessibility,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/dom';
import { useEffect, useRef, type ReactNode } from 'react';
import { LuGripVertical } from 'react-icons/lu';
import type { Issue, Workflow } from '../server/board.js';
import type { StatusControls } from './StatusControl';

const issueName = (issue: Issue | undefined) =>
  issue ? `#${issue.number}: ${issue.title}` : 'Issue';
const accessibility = Accessibility.configure({
  screenReaderInstructions: {
    draggable:
      'Press Space or Enter to pick up this issue. Use arrow keys to move to another status column; Shift plus an arrow moves faster. Press Space or Enter to drop, or Escape to cancel. The status menu is also available.',
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
    const handle = document.getElementById(`drag-${focusId.current}`);
    if (handle && !handle.hasAttribute('disabled')) {
      handle.focus();
      focusId.current = null;
    }
  });
  return (
    <DragDropProvider
      key={workflow}
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
  children,
}: {
  issue: Issue;
  disabled: boolean;
  children: ReactNode;
}) {
  const { ref, handleRef } = useDraggable({
    id: issue.id,
    type: issue.workflow ?? '',
    data: { issue },
    disabled,
  });
  return (
    <Box ref={ref} position="relative">
      {children}
      <IconButton
        ref={handleRef}
        id={`drag-${issue.id}`}
        aria-label={`Drag #${issue.number}: ${issue.title} · ${issue.path}`}
        disabled={disabled}
        size="xs"
        variant="ghost"
        position="absolute"
        bottom="1"
        left="2"
        cursor={disabled ? 'default' : 'grab'}
        touchAction="none"
      >
        <LuGripVertical />
      </IconButton>
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

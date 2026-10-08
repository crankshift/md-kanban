import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type KeyboardCoordinateGetter, type DragEndEvent } from '@dnd-kit/core';
import { Badge, Box, Button, Heading, HStack, Text } from '@chakra-ui/react';
import type { Document } from './model';

import { type StatusColumn } from './status-model';
export const cardId = (path: string) => 'status-card-' + encodeURIComponent(path);
// Keep the library's pointer lifecycle, choosing deliberate touch activation before it starts.
class WorkspacePointerSensor extends PointerSensor {
  constructor(props: ConstructorParameters<typeof PointerSensor>[0]) {
    super({ ...props, options: { ...props.options, activationConstraint: (props.event as PointerEvent).pointerType === 'touch' ? { delay: 250, tolerance: 6 } : { distance: 6 } } });
  }
}
function CardContent({ doc, scope }: { doc: Document; scope: string }) {
  const number = doc.name.match(/^(\d+)-/)?.[1];
  return <><Text as="strong" display="block" fontFamily="issueTitle" fontWeight="500" fontSize="md" lineHeight="1.25">{doc.title}</Text><HStack mt="2" gap="2" fontSize="10px" color="fg.muted">{number && <Text fontFamily="mono">#{Number(number)}</Text>}<Text truncate title={doc.path}>{scope ? doc.path.slice(scope.length + 1) : doc.path}</Text></HStack>{!doc.status.writable && <Text fontSize="10px" color="fg.warning" mt="2">{doc.status.reason}</Text>}</>;
}
function Card({ doc, scope, selected, disabled, onOpen }: { doc: Document; scope: string; selected: boolean; disabled: boolean; onOpen: () => void }) {
  const drag = useDraggable({ id: doc.path, data: { document: doc }, disabled: disabled || !doc.status.writable || !doc.revision });
  return <Box as="article" id={cardId(doc.path)} data-status-card={doc.path} ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners} aria-label={`Read ${doc.path}`} aria-disabled={disabled || undefined}
    bg={selected ? 'orange.subtle' : 'bg.panel'} borderWidth="1px" rounded="l2" p="3" mb="2" style={{ opacity: drag.isDragging ? 0.3 : 1 }} cursor={doc.status.writable && !disabled ? 'grab' : 'pointer'} touchAction={doc.status.writable && !disabled ? "none" : "pan-y"} _hover={{ bg: 'bg.emphasized' }} _focusVisible={{ outline: '2px solid', outlineColor: 'orange.500' }}
    onLostPointerCapture={() => { if (drag.isDragging) document.dispatchEvent(new Event('pointercancel', { bubbles: true })); }}
    onClick={() => { if (!drag.isDragging && doc.status.reason !== 'Creating…') onOpen(); }} onKeyDown={event => { drag.listeners?.onKeyDown?.(event); if (!event.defaultPrevented && event.key === 'Enter' && doc.status.reason !== 'Creating…') { event.preventDefault(); onOpen(); } }}><CardContent doc={doc} scope={scope} /></Box>;
}
function Column({ column, children, active }: { column: StatusColumn; children: ReactNode; active: boolean }) {
  const drop = useDroppable({ id: column.key, disabled: column.key === '@check' });
  return <Box as="section" ref={drop.setNodeRef} data-drop-status={column.key} aria-label={`${column.label} column`} flex="1 0 210px" maxW="290px" bg={active && drop.isOver ? 'orange.subtle' : 'bg.muted'} outline={active && drop.isOver ? '2px solid' : undefined} outlineColor="orange.muted" rounded="l2" p="2" overflowY="auto">{children}</Box>;
}
export function StatusBoard({ documents, scoped, columns, scope, selected, pending, onOpen, onNew, onMove }: {
  documents: Document[]; scoped: Document[]; columns: StatusColumn[]; scope: string; selected: string; pending: boolean;
  onOpen: (path: string) => void; onNew: (label: string | null) => void; onMove: (document: Document, label: string | null) => void;
}) {
  const [active, setActive] = useState<{ document: Document; width: number; height: number } | null>(null);
  const pickup = useRef<Document | null>(null);
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
    event.preventDefault();
    const available = columns.filter(c => c.key !== '@check');
    const at = available.findIndex(c => c.key === context.over?.id);
    const next = available[Math.max(0, Math.min(available.length - 1, (at < 0 ? available.findIndex(c => c.key === pickup.current?.status.key) : at) + (['ArrowLeft', 'ArrowUp'].includes(event.code) ? -1 : 1)))];
    const node = next && context.droppableContainers.get(next.key)?.node.current;
    if (!node) return currentCoordinates;
    node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const rect = node.getBoundingClientRect(), source = context.collisionRect;
    return source ? { x: currentCoordinates.x + rect.left + rect.width / 2 - (source.left + source.width / 2), y: currentCoordinates.y + rect.top + 70 - source.top } : currentCoordinates;
  };
  const sensors = useSensors(useSensor(WorkspacePointerSensor), useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, keyboardCodes: { start: ['Space'], end: ['Space', 'Enter'], cancel: ['Escape'] } }));
  useEffect(() => {
    if (!active) return;
    const old = document.body.style.cursor; document.body.style.cursor = 'grabbing';
    return () => { document.body.style.cursor = old; };
  }, [active]);
  function finish(event?: DragEndEvent) {
    const doc = pickup.current; pickup.current = null; setActive(null);
    const key = event?.over?.id;
    if (doc) requestAnimationFrame(() => document.getElementById(cardId(doc.path))?.focus());
    if (!doc || !key || key === '@check' || key === doc.status.key) return;
    const column = columns.find(c => c.key === key); if (column) onMove(doc, key === '@none' ? null : column.label);
  }
  return <DndContext sensors={sensors} collisionDetection={args => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)}
    accessibility={{ screenReaderInstructions: { draggable: 'Space picks up a card. Arrows choose a status. Space or Enter drops. Escape cancels. Enter opens a card when not dragging.' }, announcements: {
      onDragStart: ({ active }) => `Picked up ${active.id}.`, onDragOver: ({ over }) => `Over ${columns.find(c => c.key === over?.id)?.label ?? 'outside columns'}.`,
      onDragEnd: ({ over }) => over ? `Dropped on ${columns.find(c => c.key === over.id)?.label}.` : 'Outside drop cancelled.', onDragCancel: () => 'Move cancelled.',
    } }} onDragStart={event => { const doc = documents.find(doc => doc.path === event.active.id); if (!doc) return; pickup.current = doc; const rect = document.getElementById(cardId(doc.path))?.getBoundingClientRect(); setActive({ document: doc, width: rect?.width ?? 210, height: rect?.height ?? 80 }); }} onDragEnd={finish} onDragCancel={() => finish()}>
    <Box display="flex" flexDirection="column" h="full" minH="250px" p="4"><Text fontSize="xs" color="fg.muted" mb="3">Statuses from this folder · drag to change · Space + arrows works too</Text>
      <Box display="flex" gap="3" flex="1" overflow="auto" minH="0" alignItems="stretch" aria-label="Document board">{columns.map(column => {
        const cards = documents.filter(doc => doc.status.key === column.key), all = scoped.filter(doc => doc.status.key === column.key);
        return <Column key={column.key} column={column} active={!!active}><HStack gap="2" px="1" mb="3"><Heading size="xs" fontFamily="issueTitle" fontWeight="500">{column.label}</Heading>{!column.key.startsWith('value:') && <Badge size="xs" variant="outline">{column.key === '@none' ? 'missing / blank' : 'review'}</Badge>}<Text color="fg.muted" fontFamily="mono" fontSize="10px">{cards.length}{cards.length !== all.length ? `/${all.length}` : ''}</Text>{column.key !== '@check' && <Button ms="auto" size="2xs" variant="ghost" aria-label={`New issue in ${column.label}`} disabled={pending} onClick={() => onNew(column.key === '@none' ? null : column.label)}>+</Button>}</HStack>
          {cards.map(doc => <Card key={doc.path} doc={doc} scope={scope} selected={selected === doc.path} disabled={pending} onOpen={() => onOpen(doc.path)} />)}
          {!cards.length && <Text p="4" borderWidth="1px" borderStyle="dashed" rounded="l2" color="fg.muted" fontSize="xs" textAlign="center">{all.length ? 'Hidden by filters' : column.key === '@none' ? 'Drop here to clear status' : 'Empty destination'}</Text>}
        </Column>;
      })}</Box>
    </Box>
    {createPortal(<DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }} zIndex={2000}>{active && <Box data-drag-preview={active.document.path} aria-hidden="true" style={{ width: active.width, height: active.height, pointerEvents: 'none' }} bg="bg.panel" borderWidth="1px" borderColor="orange.500" rounded="l2" p="3" shadow="2xl"><CardContent doc={active.document} scope={scope} /></Box>}</DragOverlay>, document.body)}
  </DndContext>;
}

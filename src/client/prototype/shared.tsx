// PROTOTYPE — throwaway. Pieces shared by the variants; each variant owns its own layout and detail surface.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Badge, Box, Breadcrumb, Button, chakra, Code, Collapsible, Combobox, Dialog, EmptyState, Field, Flex, HStack, Icon, IconButton,
  Input, Menu, Popover, Portal, Separator, Spinner, Stack, Status, Tabs, Text, Textarea, useFilter, useListCollection,
} from '@chakra-ui/react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import {
  LuBookOpen, LuCheck, LuChevronDown, LuCornerDownLeft, LuEllipsisVertical, LuFileText, LuLink, LuMap, LuPencil, LuScale, LuSearch, LuTriangleAlert,
} from 'react-icons/lu';
import { titleSchema, type Issue, type Workflow } from '../../server/board.js';
import { resolveDependencies } from '../../server/dependencies.js';
import { openedDocumentSchema, type OpenedDocument, type SupportingDocument } from '../../server/document-types.js';
import { resolveLink } from '../Documents';
import { SafeMarkdown } from '../SafeMarkdown';
import { Prose } from '../components/ui/prose';
import { toaster } from '../components/ui/toaster';
import { Tooltip } from '../components/ui/tooltip';
import { bodyOf, commentsOf, scopeLabel, statusesFor, type EditValues, type ProtoBoard, type Recovery } from './data';

// ── Autocomplete select: every value picker is a filterable combobox, never a native <select> ─────────

export type Option = { value: string; label: string };

export function AutoSelect({ items, value, onChange, label, placeholder, size = 'sm', width, clearable = false, renderItem }: {
  items: Option[]; value: string; onChange: (value: string) => void; label: string; placeholder?: string;
  size?: 'xs' | 'sm' | 'md'; width?: string; clearable?: boolean; renderItem?: (item: Option) => ReactNode;
}) {
  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter, set } = useListCollection<Option>({
    initialItems: items, filter: contains, itemToString: (item) => item.label, itemToValue: (item) => item.value,
  });
  const itemsKey = JSON.stringify(items);
  const labelOf = (selected: string) => items.find((item) => item.value === selected)?.label ?? '';
  const [input, setInput] = useState(labelOf(value));
  useEffect(() => { set(items); }, [itemsKey]);
  useEffect(() => { setInput(labelOf(value)); }, [value, itemsKey]);
  return <Combobox.Root collection={collection} size={size} width={width} openOnClick value={value ? [value] : []} inputValue={input}
    onValueChange={(details) => onChange(details.value[0] ?? '')}
    onInputValueChange={(details) => { setInput(details.inputValue); filter(details.inputValue); }}
    onOpenChange={(details) => { if (details.open) filter(''); else setInput(labelOf(value)); }}>
    <Combobox.Control>
      <Combobox.Input aria-label={label} placeholder={placeholder ?? label} />
      <Combobox.IndicatorGroup>{clearable && <Combobox.ClearTrigger />}<Combobox.Trigger /></Combobox.IndicatorGroup>
    </Combobox.Control>
    <Portal><Combobox.Positioner><Combobox.Content>
      <Combobox.Empty>No matches</Combobox.Empty>
      {collection.items.map((item) => <Combobox.Item key={item.value} item={item}>
        <HStack gap="2" minW="0">{renderItem?.(item)}<Combobox.ItemText truncate>{item.label}</Combobox.ItemText></HStack>
        <Combobox.ItemIndicator />
      </Combobox.Item>)}
    </Combobox.Content></Combobox.Positioner></Portal>
  </Combobox.Root>;
}

export const statusOptions = (workflow: Workflow): Option[] => statusesFor(workflow).map((status) => ({ value: status, label: status }));

/** Write and Preview share one fixed-height frame, so switching tabs never resizes the surrounding dialog. */
export function MarkdownField({ value, onChange, label, from, height = '22rem', placeholder }: {
  value: string; onChange: (value: string) => void; label: string; from: string; height?: string; placeholder?: string;
}) {
  const [tab, setTab] = useState('write');
  return <Tabs.Root value={tab} onValueChange={(event) => setTab(event.value)} size="sm" variant="enclosed">
    <Tabs.List><Tabs.Trigger value="write">Write</Tabs.Trigger><Tabs.Trigger value="preview">Preview</Tabs.Trigger></Tabs.List>
    <Tabs.Content value="write" pt="2"><Textarea aria-label={label} fontFamily="mono" fontSize="sm" h={height} resize="none" placeholder={placeholder}
      value={value} onChange={(event) => onChange(event.target.value)} /></Tabs.Content>
    <Tabs.Content value="preview" pt="2"><Box h={height} overflowY="auto" borderWidth="1px" borderColor="border" rounded="l2" px="3" py="1">
      <MarkdownProse from={from}>{value || '_Nothing to preview._'}</MarkdownProse></Box></Tabs.Content>
  </Tabs.Root>;
}

// ── Status ────────────────────────────────────────────────────────────────────────────────────────────

const tones: Record<string, string | undefined> = {
  'needs-triage': 'gray', 'needs-info': 'yellow', 'ready-for-agent': undefined, 'ready-for-human': 'teal', wontfix: 'red',
  open: 'gray', claimed: 'yellow', resolved: 'green',
};
const toneProps = (status: string | null) => {
  const tone = status ? tones[status] : 'gray';
  return tone ? { colorPalette: tone } : {};
};

export function StatusDot({ status, children }: { status: string | null; children?: ReactNode }) {
  return <Status.Root size="sm" {...toneProps(status)}><Status.Indicator />{children}</Status.Root>;
}

/** Badge-style trigger in details; a quiet kebab on cards. Both move the issue immediately. */
export function StatusMenu({ issue, board, compact = false }: { issue: Issue; board: ProtoBoard; compact?: boolean }) {
  if (!issue.workflow || !issue.revision) return null;
  const busy = board.pending.has(issue.id);
  return <Menu.Root onSelect={(details) => { void board.moveStatus(issue.id, details.value); }}>
    <Menu.Trigger asChild>
      {compact
        ? <IconButton aria-label={`Change status of #${issue.number}`} size="2xs" variant="ghost" color="fg.subtle" disabled={busy}
            onClick={(event) => event.stopPropagation()}><LuEllipsisVertical /></IconButton>
        : <Button size="xs" variant="subtle" {...toneProps(issue.status)} disabled={busy} aria-label="Issue status">
            <StatusDot status={issue.status}>{issue.status}</StatusDot>{busy && <Spinner size="xs" />}
          </Button>}
    </Menu.Trigger>
    <Portal><Menu.Positioner><Menu.Content minW="44">
      <Menu.ItemGroup>
        <Menu.ItemGroupLabel>Move to</Menu.ItemGroupLabel>
        {statusesFor(issue.workflow).map((status) => <Menu.Item key={status} value={status} disabled={status === issue.status}>
          <StatusDot status={status} />{status}{status === issue.status && <Icon ms="auto"><LuCheck /></Icon>}
        </Menu.Item>)}
      </Menu.ItemGroup>
    </Menu.Content></Menu.Positioner></Portal>
  </Menu.Root>;
}

// ── Dependencies ──────────────────────────────────────────────────────────────────────────────────────

export function DependencyChips({ issue, issues }: { issue: Issue; issues: Issue[] }) {
  const deps = resolveDependencies(issue, issues);
  if (deps.length === 0) return null;
  const count = (state: string) => deps.filter((dep) => dep.kind === 'linked' && dep.state === state).length;
  const broken = deps.filter((dep) => dep.kind !== 'linked' || dep.state === 'unknown').length;
  return <HStack gap="1" mt="1.5" wrap="wrap">
    {count('blocked') > 0 && <Badge size="xs" colorPalette="red" variant="subtle">Blocked by {count('blocked')}</Badge>}
    {count('advisory') > 0 && <Badge size="xs" variant="outline" colorPalette="gray"><LuLink />Needs {deps.filter((dep) => dep.kind === 'linked' && dep.state === 'advisory').map((dep) => dep.kind === 'linked' ? `#${dep.target.number}` : '').join(', ')}</Badge>}
    {count('resolved') > 0 && <Badge size="xs" colorPalette="green" variant="subtle">{count('resolved')} resolved</Badge>}
    {broken > 0 && <Badge size="xs" colorPalette="yellow" variant="subtle"><LuTriangleAlert />{broken} unclear</Badge>}
  </HStack>;
}

function DependencyList({ issue, issues, onOpenIssue }: { issue: Issue; issues: Issue[]; onOpenIssue: (id: string) => void }) {
  const deps = resolveDependencies(issue, issues);
  if (deps.length === 0) return null;
  return <Stack gap="1.5">
    <Text fontSize="xs" fontWeight="semibold" color="fg.muted">Depends on</Text>
    {deps.map((dep, index) => dep.kind === 'linked'
      ? <HStack key={index} gap="2" fontSize="sm">
          <Code size="sm" variant="plain" color="fg.subtle">#{dep.target.number}</Code>
          <chakra.button textAlign="start" color="colorPalette.fg" _hover={{ textDecoration: 'underline' }} onClick={() => onOpenIssue(dep.target.id)}>{dep.target.title}</chakra.button>
          <Text ms="auto" fontSize="xs" color="fg.muted" flexShrink="0">{dep.state === 'blocked' ? 'Unresolved' : dep.state === 'resolved' ? 'Resolved' : dep.state === 'unknown' ? 'State unknown' : dep.target.status}</Text>
        </HStack>
      : <HStack key={index} gap="2" fontSize="sm" color="fg.warning"><LuTriangleAlert />
          <Text>{dep.reference || '(empty)'}: {dep.kind === 'missing' ? 'no issue with this number here' : dep.kind === 'ambiguous' ? 'several issues share this number' : 'not an issue number'}</Text>
        </HStack>)}
  </Stack>;
}

// ── Cards and columns ─────────────────────────────────────────────────────────────────────────────────

export function IssueCard({ issue, board, onOpen, showFeature = true }: { issue: Issue; board: ProtoBoard; onOpen: (id: string) => void; showFeature?: boolean }) {
  const pending = board.pending.has(issue.id);
  const creating = issue.number === null;
  const { ref, isDragging } = useDraggable({ id: issue.id, disabled: pending || creating });
  return <Box ref={ref} as="article" display="grid" gridTemplateColumns="2.6rem minmax(0, 1fr) auto" alignItems="start"
    bg="bg.panel" borderWidth="1px" borderColor="border.muted" rounded="l2" py="2.5" pe="1.5" cursor={creating ? 'progress' : 'grab'}
    opacity={pending || creating ? 0.7 : 1} boxShadow={isDragging ? 'lg' : 'none'} transition="border-color 120ms"
    _hover={{ borderColor: 'border.emphasized' }} onClick={() => !creating && onOpen(issue.id)}>
    <Text fontFamily="mono" fontSize="md" lineHeight="1.25" color="fg.subtle" textAlign="end" pe="2.5" me="0.5"
      borderEndWidth="1px" borderColor="border.muted" userSelect="none">{creating ? '··' : issue.number}</Text>
    <Box ps="2.5" minW="0">
      <chakra.button display="block" textAlign="start" fontSize="sm" fontWeight="medium" lineHeight="1.35" lineClamp="3"
        aria-label={`Open #${issue.number}: ${issue.title}`} onClick={(event) => { event.stopPropagation(); if (!creating) onOpen(issue.id); }}>{issue.title}</chakra.button>
      {showFeature && <Text fontSize="xs" color="fg.muted" mt="0.5" truncate>{issue.feature}{issue.location !== '.' && <Text as="span" color="fg.subtle"> in {issue.location}</Text>}</Text>}
      {creating ? <HStack mt="1.5" gap="1.5" fontSize="xs" color="fg.muted"><Spinner size="xs" />Creating file…</HStack>
        : <DependencyChips issue={issue} issues={board.issues} />}
    </Box>
    <Box>{pending ? <Spinner size="xs" m="1.5" color="fg.subtle" /> : <StatusMenu issue={issue} board={board} compact />}</Box>
  </Box>;
}

function Column({ status, issues, board, onOpen, showFeature }: { status: string; issues: Issue[]; board: ProtoBoard; onOpen: (id: string) => void; showFeature: boolean }) {
  const { ref, isDropTarget } = useDroppable({ id: status });
  return <Flex ref={ref} direction="column" minW="248px" flex="1" bg={isDropTarget ? 'colorPalette.subtle' : 'bg.muted/60'}
    rounded="l3" p="2" gap="2" borderWidth="1px" borderColor={isDropTarget ? 'colorPalette.emphasized' : 'transparent'}
    transition="background 120ms" aria-label={`${status} column`}>
    <HStack px="1.5" pt="1" pb="0.5" justify="space-between">
      <StatusDot status={status}><Text fontSize="sm" fontWeight="semibold">{status}</Text></StatusDot>
      <Text fontSize="xs" color="fg.muted" fontFamily="mono">{issues.length}</Text>
    </HStack>
    {issues.map((issue) => <IssueCard key={issue.id} issue={issue} board={board} onOpen={onOpen} showFeature={showFeature} />)}
    {issues.length === 0 && <Text fontSize="xs" color="fg.subtle" px="1.5" py="3">Drop an issue here</Text>}
  </Flex>;
}

export function KanbanColumns({ issues, workflow, board, onOpen, showFeature = true }: {
  issues: Issue[]; workflow: Workflow; board: ProtoBoard; onOpen: (id: string) => void; showFeature?: boolean;
}) {
  return <DragDropProvider onDragEnd={(event) => {
    const { source, target } = event.operation;
    if (event.canceled || !source || !target) return;
    void board.moveStatus(String(source.id), String(target.id));
  }}>
    <Flex gap="3" align="start" overflowX="auto" pb="4" minH="0">
      {statusesFor(workflow).map((status) => <Column key={status} status={status} board={board} onOpen={onOpen} showFeature={showFeature}
        issues={issues.filter((issue) => issue.status === status)} />)}
    </Flex>
  </DragDropProvider>;
}

export function BoardEmpty({ workflow, filtered, onClear }: { workflow: Workflow; filtered: boolean; onClear: () => void }) {
  return <EmptyState.Root size="sm"><EmptyState.Content>
    <EmptyState.Indicator><LuFileText /></EmptyState.Indicator>
    <EmptyState.Title>{filtered ? 'No issues match these filters' : `No ${workflow} issues in this folder`}</EmptyState.Title>
    <EmptyState.Description>{filtered ? 'Search covers titles and bodies.' : workflow === 'wayfinding'
      ? 'Wayfinding issues live next to a map.md file.' : 'Implementation issues live in an issues/ or tickets/ folder.'}</EmptyState.Description>
    {filtered && <Button size="sm" variant="outline" onClick={onClear}>Clear filters</Button>}
  </EmptyState.Content></EmptyState.Root>;
}

// ── Header widgets ────────────────────────────────────────────────────────────────────────────────────

export function LiveIndicator({ live }: { live: ProtoBoard['live'] }) {
  return <Tooltip content={live === 'live' ? 'Changes made outside the app appear automatically.' : live === 'offline'
    ? 'Live updates are disconnected. Reconnecting…' : 'Connecting to the local server…'}>
    <Status.Root size="sm" colorPalette={live === 'live' ? 'green' : live === 'offline' ? 'red' : 'gray'} color="fg.muted" fontSize="xs">
      <Status.Indicator />{live === 'live' ? 'Live' : live === 'offline' ? 'Offline' : 'Connecting'}
    </Status.Root>
  </Tooltip>;
}

export function AttentionPopover({ board, onOpen }: { board: ProtoBoard; onOpen: (id: string) => void }) {
  const attention = board.issues.filter((issue) => issue.diagnostics.length > 0);
  if (attention.length === 0) return null;
  return <Popover.Root positioning={{ placement: 'bottom-end' }}>
    <Popover.Trigger asChild>
      <Button size="xs" variant="subtle" colorPalette="yellow"><LuTriangleAlert />{attention.length} need attention</Button>
    </Popover.Trigger>
    <Portal><Popover.Positioner><Popover.Content w="sm">
      <Popover.Arrow />
      <Popover.Body p="3"><Stack gap="3">
        <Text fontSize="xs" color="fg.muted">These files look like issues but can't be placed on the board. Nothing is changed until you edit them.</Text>
        {attention.map((issue) => <Stack key={issue.id} gap="1">
          <Text fontFamily="mono" fontSize="xs">{issue.path}</Text>
          {issue.diagnostics.map((reason) => <Text key={reason} fontSize="xs" color="fg.warning">{reason}</Text>)}
          <Button size="2xs" variant="outline" alignSelf="start" onClick={() => onOpen(issue.id)}>Read file</Button>
        </Stack>)}
      </Stack></Popover.Body>
    </Popover.Content></Popover.Positioner></Portal>
  </Popover.Root>;
}

export const documentIcon = (kind: SupportingDocument['kind'] | OpenedDocument['kind']) =>
  kind === 'adr' ? <LuScale /> : kind === 'map' ? <LuMap /> : kind === 'specification' ? <LuBookOpen /> : <LuFileText />;
export const documentGroups = [['specification', 'Specifications'], ['map', 'Wayfinding maps'], ['adr', 'Decisions']] as const;

// ── Detail stack: issue ⇄ document navigation with a Back history and an unsaved-changes guard ──────

export type Entry = { kind: 'issue'; id: string } | { kind: 'doc'; path: string; fragment: string | null };

export function useDetail(board: ProtoBoard, recovery: Recovery | null, clearRecovery: () => void) {
  const [stack, setStack] = useState<Entry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<(() => void) | null>(null);
  const guard = (action: () => void) => { if (dirty) setConfirm(() => action); else action(); };
  useEffect(() => { if (recovery) { setStack([{ kind: 'issue', id: recovery.issueId }]); setDirty(false); } }, [recovery]);
  const current = stack.at(-1) ?? null;
  async function follow(from: string, href: string) {
    const link = await resolveLink(from, href);
    if (link.status === 'unavailable') { toaster.create({ type: 'warning', title: 'This link is unavailable', description: `${href}: ${link.reason}` }); return; }
    const entry: Entry = link.issue && board.issues.some((issue) => issue.id === link.path)
      ? { kind: 'issue', id: link.path } : { kind: 'doc', path: link.path, fragment: link.fragment };
    guard(() => { setDirty(false); setStack((items) => [...items, entry]); });
  }
  return {
    stack, current, isOpen: stack.length > 0,
    open: (entry: Entry) => guard(() => { setDirty(false); clearRecovery(); setStack([entry]); }),
    push: (entry: Entry) => guard(() => { setDirty(false); setStack((items) => [...items, entry]); }),
    back: () => guard(() => { setDirty(false); setStack((items) => items.slice(0, -1)); }),
    jump: (index: number) => guard(() => { setDirty(false); setStack((items) => items.slice(0, index + 1)); }),
    close: () => guard(() => { setDirty(false); clearRecovery(); setStack([]); }),
    follow, setDirty, recovery,
    discardDialog: <DiscardDialog open={confirm !== null} onKeep={() => setConfirm(null)}
      onDiscard={() => { const action = confirm; setConfirm(null); setDirty(false); action?.(); }} />,
  };
}
export type Detail = ReturnType<typeof useDetail>;

export function DiscardDialog({ open, onKeep, onDiscard }: { open: boolean; onKeep: () => void; onDiscard: () => void }) {
  return <Dialog.Root role="alertdialog" open={open} onOpenChange={(event) => { if (!event.open) onKeep(); }} size="sm" placement="center">
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
      <Dialog.Header><Dialog.Title>Discard unsaved changes?</Dialog.Title></Dialog.Header>
      <Dialog.Body><Text fontSize="sm" color="fg.muted">Your edits haven't been written to the file. Discarding them can't be undone.</Text></Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" size="sm" onClick={onKeep}>Keep editing</Button>
        <Button colorPalette="red" size="sm" onClick={onDiscard}>Discard changes</Button>
      </Dialog.Footer>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>;
}

export function DetailBreadcrumb({ detail, board }: { detail: Detail; board: ProtoBoard }) {
  if (detail.stack.length < 2) return null;
  const name = (entry: Entry) => entry.kind === 'issue'
    ? `#${board.issues.find((issue) => issue.id === entry.id)?.number ?? '?'}`
    : board.documents.find((doc) => doc.path === entry.path)?.title ?? entry.path.split('/').at(-1);
  return <Breadcrumb.Root size="sm"><Breadcrumb.List>
    {detail.stack.map((entry, index) => index === detail.stack.length - 1
      ? <Breadcrumb.Item key={index}><Breadcrumb.CurrentLink maxW="48" truncate>{name(entry)}</Breadcrumb.CurrentLink></Breadcrumb.Item>
      : [<Breadcrumb.Item key={index}><Breadcrumb.Link asChild><chakra.button maxW="40" truncate onClick={() => detail.jump(index)}>{name(entry)}</chakra.button></Breadcrumb.Link></Breadcrumb.Item>,
         <Breadcrumb.Separator key={`s${index}`} />])}
  </Breadcrumb.List></Breadcrumb.Root>;
}

/** Whatever the top of the stack is: an issue or a read-only document. */
export function DetailContent({ detail, board, layout = 'stack' }: { detail: Detail; board: ProtoBoard; layout?: 'stack' | 'split' }) {
  const entry = detail.current;
  if (!entry) return null;
  if (entry.kind === 'doc') return <DocumentView key={entry.path} path={entry.path} fragment={entry.fragment} onLink={(from, href) => { void detail.follow(from, href); }} />;
  const issue = board.issues.find((candidate) => candidate.id === entry.id);
  if (!issue) return <Alert.Root status="warning"><Alert.Indicator /><Alert.Content>
    <Alert.Title>This file is no longer on the board</Alert.Title>
    <Alert.Description>It was removed, renamed, or moved outside the app. If it comes back, it shows here again.</Alert.Description>
  </Alert.Content></Alert.Root>;
  const recovery = detail.recovery?.issueId === issue.id ? detail.recovery : null;
  return <IssueView key={issue.id} issue={issue} board={board} layout={layout} recovery={recovery} onDirty={detail.setDirty}
    onOpenIssue={(id) => detail.push({ kind: 'issue', id })} onLink={(from, href) => { void detail.follow(from, href); }} />;
}

// ── Issue view and editor ─────────────────────────────────────────────────────────────────────────────

const valuesOf = (issue: Issue): EditValues => ({ title: issue.title, status: issue.status ?? '', body: bodyOf(issue) });
const fieldNames: Record<keyof EditValues, string> = { title: 'Title', status: 'Status', body: 'Body' };
const changedFields = (a: EditValues, b: EditValues) => (Object.keys(fieldNames) as (keyof EditValues)[]).filter((key) => a[key] !== b[key]);

function MarkdownProse({ children, onLink, from }: { children: string; from: string; onLink?: ((from: string, href: string) => void) | undefined }) {
  return <Prose maxW="72ch" color="fg" fontSize="sm" css={{ '& h3, & h2': { fontSize: 'md' } }}>
    <SafeMarkdown onLocalLink={onLink && ((href) => onLink(from, href))}>{children}</SafeMarkdown>
  </Prose>;
}

function IssueView({ issue, board, layout, recovery, onDirty, onOpenIssue, onLink }: {
  issue: Issue; board: ProtoBoard; layout: 'stack' | 'split'; recovery: Recovery | null;
  onDirty: (dirty: boolean) => void; onOpenIssue: (id: string) => void; onLink: (from: string, href: string) => void;
}) {
  const [editing, setEditing] = useState<{ base: Issue; values: EditValues } | null>(() =>
    recovery ? { base: { ...issue, revision: recovery.baseRevision }, values: recovery.values } : null);
  const [comment, setComment] = useState('');
  const [confirmOverlap, setConfirmOverlap] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const editable = !!issue.workflow && issue.content !== null && issue.diagnostics.length === 0;
  const baseValues = editing ? valuesOf(editing.base) : null;
  const mine = editing && baseValues ? changedFields(editing.values, baseValues) : [];
  const conflict = !!editing && editing.base.revision !== issue.revision;
  const theirs = conflict && baseValues ? changedFields(valuesOf(issue), baseValues) : [];
  const overlap = mine.filter((field) => theirs.includes(field));
  const dirty = mine.length > 0 || comment.trim().length > 0;
  useEffect(() => { onDirty(dirty); }, [dirty]);
  const titleError = editing && !titleSchema.safeParse(editing.values.title).success ? 'Enter a single-line title.' : null;
  const set = (patch: Partial<EditValues>) => setEditing((current) => current && { ...current, values: { ...current.values, ...patch } });
  function reapply() {
    if (overlap.length && !confirmOverlap) { setConfirmOverlap(true); return; }
    const latest = valuesOf(issue);
    setEditing({ base: issue, values: { ...latest, ...Object.fromEntries(mine.map((field) => [field, editing!.values[field]])) } });
    setConfirmOverlap(false);
  }
  async function sendComment() {
    const text = comment.trim();
    if (!text) return;
    setComment('');
    if (!(await board.addComment(issue.id, text))) setComment(text);
  }

  const meta = <Stack gap="4" fontSize="sm">
    <Stack gap="1"><Text fontSize="xs" color="fg.muted">Status</Text>
      {issue.workflow ? <Box><StatusMenu issue={issue} board={board} /></Box> : <Text color="fg.warning">Unrecognized</Text>}</Stack>
    <Stack gap="1"><Text fontSize="xs" color="fg.muted">{scopeLabel(issue.workflow)}</Text><Text>{issue.feature}</Text></Stack>
    <Stack gap="1"><Text fontSize="xs" color="fg.muted">Location</Text><Text fontFamily="mono" fontSize="xs">{issue.location}</Text></Stack>
    <Stack gap="1"><Text fontSize="xs" color="fg.muted">File</Text><Text fontFamily="mono" fontSize="xs" wordBreak="break-all">{issue.path}</Text></Stack>
    <DependencyList issue={issue} issues={board.issues} onOpenIssue={onOpenIssue} />
  </Stack>;

  const header = <Stack gap="2">
    <HStack gap="2" color="fg.muted" fontSize="sm">
      <Text fontFamily="mono" color="fg.subtle">#{issue.number ?? '··'}</Text>
      {layout === 'stack' && <Text truncate>{issue.feature}{issue.location !== '.' ? ` in ${issue.location}` : ''}</Text>}
      {board.pending.has(issue.id) && <HStack gap="1"><Spinner size="xs" />Saving</HStack>}
      {editable && !editing && <Button ms="auto" size="xs" variant="outline" onClick={() => setEditing({ base: issue, values: valuesOf(issue) })}><LuPencil />Edit</Button>}
    </HStack>
    {editing
      ? <Field.Root invalid={!!titleError}><Field.Label srOnly>Title</Field.Label>
          <Input aria-label="Issue title" size="lg" fontWeight="semibold" value={editing.values.title} onChange={(event) => set({ title: event.target.value })} />
          {titleError && <Field.ErrorText>{titleError}</Field.ErrorText>}</Field.Root>
      : <Text as="h2" fontSize="xl" fontWeight="semibold" lineHeight="1.3" textWrap="balance">{issue.title}</Text>}
    {layout === 'stack' && !editing && <HStack gap="3" wrap="wrap"><StatusMenu issue={issue} board={board} /><DependencyChips issue={issue} issues={board.issues} /></HStack>}
  </Stack>;

  const conflictBanner = conflict && <Alert.Root status="warning" size="sm">
    <Alert.Indicator />
    <Alert.Content gap="2">
      <Alert.Title>This file changed on disk while you were editing</Alert.Title>
      <Alert.Description>
        <Text>Changed on disk: {theirs.map((field) => fieldNames[field]).join(', ') || 'formatting only'}. Changed by you: {mine.map((field) => fieldNames[field]).join(', ') || 'nothing'}.</Text>
        {confirmOverlap && <Text mt="1" fontWeight="medium">Both of you changed {overlap.map((field) => fieldNames[field].toLowerCase()).join(' and ')}. Reapplying replaces the version on disk for {overlap.length > 1 ? 'those fields' : 'that field'}.</Text>}
      </Alert.Description>
      <HStack gap="2">
        <Button size="xs" variant="outline" onClick={() => { setEditing({ base: issue, values: valuesOf(issue) }); setConfirmOverlap(false); }}>Discard mine</Button>
        <Button size="xs" colorPalette={confirmOverlap ? 'red' : undefined} onClick={reapply}>{confirmOverlap ? 'Confirm reapply' : 'Reapply mine on latest'}</Button>
      </HStack>
    </Alert.Content>
  </Alert.Root>;

  const body = editing
    ? <Stack gap="3">
        {conflictBanner}
        <HStack gap="3"><Text fontSize="sm" color="fg.muted">Status</Text>
          <AutoSelect label="Issue status" width="14rem" size="xs" items={statusOptions(issue.workflow!)} value={editing.values.status}
            onChange={(status) => { if (status) set({ status }); }} renderItem={(item) => <StatusDot status={item.value} />} /></HStack>
        <MarkdownField label="Markdown body" from={issue.path} value={editing.values.body} onChange={(body) => set({ body })} height="min(28rem, 50vh)" />
        <HStack justify="end" gap="2">
          <Button size="sm" variant="ghost" onClick={() => mine.length ? setConfirmCancel(true) : setEditing(null)}>Cancel</Button>
          <DiscardDialog open={confirmCancel} onKeep={() => setConfirmCancel(false)} onDiscard={() => { setConfirmCancel(false); setEditing(null); }} />
          <Button size="sm" disabled={mine.length === 0 || conflict || !!titleError}
            onClick={() => { void board.saveEdit(issue.id, editing.base.revision, editing.values); setEditing(null); }}>Save changes</Button>
        </HStack>
      </Stack>
    : issue.diagnostics.length > 0
      ? <Stack gap="3"><Alert.Root status="warning" size="sm"><Alert.Indicator /><Alert.Content>
          <Alert.Title>This file can't be placed on the board</Alert.Title>
          <Alert.Description><Stack as="ul" gap="0.5" ps="4" listStyleType="disc">{issue.diagnostics.map((reason) => <li key={reason}>{reason}</li>)}</Stack></Alert.Description>
        </Alert.Content></Alert.Root>
        <Code as="pre" display="block" whiteSpace="pre-wrap" p="3" fontSize="xs">{issue.content ?? 'The file could not be read.'}</Code></Stack>
      : <MarkdownProse from={issue.path} onLink={onLink}>{bodyOf(issue)}</MarkdownProse>;

  const comments = editable && <Stack gap="3">
    <Separator />
    <Text fontSize="sm" fontWeight="semibold">Comments</Text>
    {commentsOf(issue) ? <MarkdownProse from={issue.path} onLink={onLink}>{commentsOf(issue)}</MarkdownProse> : <Text fontSize="sm" color="fg.muted">No comments yet.</Text>}
    <Textarea aria-label="New comment" placeholder="Add a comment in Markdown" size="sm" autoresize minH="20" value={comment} onChange={(event) => setComment(event.target.value)} />
    <Button size="sm" alignSelf="end" variant="outline" disabled={!comment.trim()} onClick={() => { void sendComment(); }}>Add comment</Button>
  </Stack>;

  if (layout === 'split') return <Box display="grid" gridTemplateColumns={{ base: '1fr', lg: 'minmax(0, 1fr) 17rem' }} gap="10">
    <Stack gap="6" minW="0">{header}{body}{comments}</Stack>
    <Box borderStartWidth={{ lg: '1px' }} borderColor="border.muted" ps={{ lg: '6' }}>{meta}</Box>
  </Box>;
  return <Stack gap="5">
    {header}
    {!editing && <DependencyList issue={issue} issues={board.issues} onOpenIssue={onOpenIssue} />}
    {body}
    {comments}
    <Text fontFamily="mono" fontSize="xs" color="fg.subtle">{issue.path}</Text>
  </Stack>;
}

function DocumentView({ path, fragment, onLink }: { path: string; fragment: string | null; onLink: (from: string, href: string) => void }) {
  const [document, setDocument] = useState<OpenedDocument | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const response = await fetch(`/api/document?${new URLSearchParams({ path })}`);
      const value: unknown = await response.json();
      if (!alive) return;
      if (response.ok) setDocument(openedDocumentSchema.parse(value));
      else setFailed(typeof value === 'object' && value && 'error' in value ? String(value.error) : 'Unavailable');
    })();
    return () => { alive = false; };
  }, [path]);
  if (failed) return <Alert.Root status="error"><Alert.Indicator /><Alert.Title>{failed}</Alert.Title></Alert.Root>;
  if (!document) return <Spinner />;
  return <Stack gap="4">
    <HStack gap="2" color="fg.muted" fontSize="sm"><Icon>{documentIcon(document.kind)}</Icon>
      <Text>{({ specification: 'Specification', map: 'Wayfinding map', adr: 'Decision record', document: 'Document' })[document.kind]}</Text>
      <Badge size="xs" variant="outline">Read-only</Badge></HStack>
    <Text fontFamily="mono" fontSize="xs" color="fg.subtle">{document.path}</Text>
    <Prose maxW="72ch" color="fg" fontSize="sm">
      <SafeMarkdown fragment={fragment} onLocalLink={(href) => onLink(document.path, href)}
        onMissingFragment={(missing) => toaster.create({ type: 'info', title: `Section "${missing}" isn't in this document` })}>{document.content}</SafeMarkdown>
    </Prose>
  </Stack>;
}

// ── Create ────────────────────────────────────────────────────────────────────────────────────────────

export function CreateIssueDialog({ open, onClose, board, workflow }: { open: boolean; onClose: () => void; board: ProtoBoard; workflow: Workflow }) {
  const targets = useMemo(() => board.targets.filter((target) => target.workflow === workflow), [board.targets, workflow]);
  const [target, setTarget] = useState('');
  const [values, setValues] = useState<EditValues>({ title: '', status: statusesFor(workflow)[0]!, body: '' });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (open) { setTarget(targets[0]?.container ?? ''); setValues({ title: '', status: statusesFor(workflow)[0]!, body: '' }); } }, [open]);
  const dirty = !!values.title || !!values.body;
  const close = () => dirty ? setConfirm(true) : onClose();
  const selected = targets.find((candidate) => candidate.container === target);
  const valid = titleSchema.safeParse(values.title).success && !!selected;
  return <>
    <Dialog.Root open={open} onOpenChange={(event) => { if (!event.open) close(); }} size="lg" placement="center">
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>New {workflow} issue</Dialog.Title></Dialog.Header>
        <Dialog.Body><Stack gap="4">
          <HStack gap="3" align="start">
            <Field.Root flex="2"><Field.Label>{scopeLabel(workflow)}</Field.Label>
              <AutoSelect label="New issue container" items={targets.map((candidate) => ({ value: candidate.container, label: `${candidate.feature} (${candidate.location})` }))}
                value={target} onChange={(next) => { if (next) setTarget(next); }} />
              <Field.HelperText>Gets the next free number in this folder.</Field.HelperText></Field.Root>
            <Field.Root flex="1"><Field.Label>Status</Field.Label>
              <AutoSelect label="New issue status" items={statusOptions(workflow)} value={values.status} renderItem={(item) => <StatusDot status={item.value} />}
                onChange={(status) => { if (status) setValues({ ...values, status }); }} /></Field.Root>
          </HStack>
          <Field.Root required><Field.Label>Title</Field.Label>
            <Input aria-label="New issue title" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} /></Field.Root>
          <MarkdownField label="New issue body" from="" placeholder="## Outcome" height="16rem" value={values.body} onChange={(body) => setValues({ ...values, body })} />
        </Stack></Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
          <Button size="sm" disabled={!valid} aria-label="Create issue" onClick={() => { if (selected) void board.create(selected, values); onClose(); }}>Create issue</Button>
        </Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
    <DiscardDialog open={confirm} onKeep={() => setConfirm(false)} onDiscard={() => { setConfirm(false); onClose(); }} />
  </>;
}

// ── List view and command palette ─────────────────────────────────────────────────────────────────────

function ListRow({ issue, board, onOpen, showFeature }: { issue: Issue; board: ProtoBoard; onOpen: (id: string) => void; showFeature: boolean }) {
  return <Box display="grid" gridTemplateColumns={showFeature ? '3rem minmax(0, 1fr) 13rem 12rem 10rem' : '3rem minmax(0, 1fr) 12rem 10rem'} alignItems="center" gap="3"
    px="3" py="1.5" borderBottomWidth="1px" borderColor="border.muted" _hover={{ bg: 'bg.muted' }} cursor="pointer" onClick={() => onOpen(issue.id)}
    opacity={board.pending.has(issue.id) || issue.number === null ? 0.6 : 1}>
    <Text fontFamily="mono" fontSize="sm" color="fg.subtle" textAlign="end">{issue.number ?? '··'}</Text>
    <chakra.button textAlign="start" fontSize="sm" fontWeight="medium" truncate aria-label={`Open #${issue.number}: ${issue.title}`}>{issue.title}</chakra.button>
    {showFeature && <Text fontSize="xs" color="fg.muted" truncate>{issue.feature}{issue.location !== '.' ? ` in ${issue.location}` : ''}</Text>}
    <Box mt="-1.5"><DependencyChips issue={issue} issues={board.issues} /></Box>
    <Box justifySelf="end" onClick={(event) => event.stopPropagation()}><StatusMenu issue={issue} board={board} /></Box>
  </Box>;
}

/** Dense alternative to columns: one collapsible group per status, same status menu on every row. */
export function StatusList({ issues, workflow, board, onOpen, showFeature = true }: {
  issues: Issue[]; workflow: Workflow; board: ProtoBoard; onOpen: (id: string) => void; showFeature?: boolean;
}) {
  return <Stack gap="4" pb="10">{statusesFor(workflow).map((status) => {
    const rows = issues.filter((issue) => issue.status === status);
    return <Collapsible.Root key={status} defaultOpen={rows.length > 0}>
      <Collapsible.Trigger asChild><chakra.button display="flex" alignItems="center" gap="2" w="full" py="1.5" px="1" borderBottomWidth="1px" borderColor="border">
        <Icon color="fg.muted" transition="transform 120ms" css={{ '[data-state=closed] > &': { transform: 'rotate(-90deg)' } }}><LuChevronDown /></Icon>
        <StatusDot status={status}><Text fontSize="sm" fontWeight="semibold">{status}</Text></StatusDot>
        <Text fontFamily="mono" fontSize="xs" color="fg.muted">{rows.length}</Text>
      </chakra.button></Collapsible.Trigger>
      <Collapsible.Content>{rows.map((issue) => <ListRow key={issue.id} issue={issue} board={board} onOpen={onOpen} showFeature={showFeature} />)}
        {rows.length === 0 && <Text fontSize="xs" color="fg.subtle" px="3" py="2">Nothing here.</Text>}</Collapsible.Content>
    </Collapsible.Root>;
  })}</Stack>;
}

export function useHotkey(test: (event: KeyboardEvent) => boolean, action: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]');
      if (test(event) && (!typing || event.metaKey || event.ctrlKey)) { event.preventDefault(); action(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}

export function CommandPalette({ open, onClose, board, onPick }: { open: boolean; onClose: () => void; board: ProtoBoard; onPick: (entry: Entry) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);
  const q = query.trim().toLowerCase();
  const results: { entry: Entry; label: string; hint: string; icon: ReactNode }[] = [
    ...board.issues.filter((issue) => issue.number && (!q || `${issue.number} ${issue.title} ${issue.content ?? ''}`.toLowerCase().includes(q)))
      .map((issue) => ({ entry: { kind: 'issue' as const, id: issue.id }, label: issue.title, hint: `#${issue.number} · ${issue.feature}`, icon: <StatusDot status={issue.status} /> })),
    ...board.documents.filter((doc) => !q || doc.title.toLowerCase().includes(q) || doc.path.toLowerCase().includes(q))
      .map((doc) => ({ entry: { kind: 'doc' as const, path: doc.path, fragment: null }, label: doc.title, hint: doc.path, icon: <Icon color="fg.muted">{documentIcon(doc.kind)}</Icon> })),
  ].slice(0, 12);
  const pick = (index: number) => { const result = results[index]; if (result) { onPick(result.entry); onClose(); } };
  return <Dialog.Root open={open} onOpenChange={(event) => { if (!event.open) onClose(); }} placement="top" size="lg">
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content mt="15vh">
      <HStack px="4" borderBottomWidth="1px" borderColor="border.muted"><Icon color="fg.muted"><LuSearch /></Icon>
        <Input variant="flushed" border="0" size="lg" placeholder="Search issues and documents" aria-label="Search issues and documents" value={query} autoFocus
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, results.length - 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
            if (event.key === 'Enter') pick(active);
          }} /></HStack>
      <Stack gap="0" p="2" maxH="60vh" overflowY="auto" role="listbox">
        {results.length === 0 && <Text p="4" fontSize="sm" color="fg.muted">Nothing matches "{query}".</Text>}
        {results.map((result, index) => <HStack key={index} role="option" aria-selected={index === active} px="3" py="2" rounded="l2" gap="3" cursor="pointer"
          bg={index === active ? 'colorPalette.subtle' : undefined} onMouseEnter={() => setActive(index)} onClick={() => pick(index)}>
          {result.icon}<Text fontSize="sm" truncate flex="1">{result.label}</Text>
          <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate maxW="50%">{result.hint}</Text>
          {index === active && <Icon color="fg.muted"><LuCornerDownLeft /></Icon>}
        </HStack>)}
      </Stack>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>;
}

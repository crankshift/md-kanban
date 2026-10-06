// PROTOTYPE — throwaway. Variant C: dense list grouped by status (board optional), full-page details, ⌘K palette to search and jump.
import { useEffect, useState, type ReactNode } from 'react';
import { Box, Button, chakra, Collapsible, Dialog, Flex, HStack, Icon, Input, Kbd, NativeSelect, Portal, SegmentGroup, Stack, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuChevronDown, LuColumns3, LuCornerDownLeft, LuList, LuPlus, LuSearch } from 'react-icons/lu';
import type { Issue, Workflow } from '../../server/board.js';
import { ColorModeButton } from '../components/ui/color-mode';
import { featureKey, filterIssues, noFilters, scopeLabel, statusesFor, type Filters, type ProtoBoard } from './data';
import {
  AttentionPopover, BoardEmpty, CreateIssueDialog, DependencyChips, DetailBreadcrumb, DetailContent, documentIcon, KanbanColumns, LiveIndicator,
  StatusDot, StatusMenu, useDetail, type Entry,
} from './shared';
import type { VariantProps } from './PrototypeApp';

export const name = 'List + full page';

function Row({ issue, board, onOpen }: { issue: Issue; board: ProtoBoard; onOpen: (id: string) => void }) {
  return <Box display="grid" gridTemplateColumns="3rem minmax(0, 1fr) 14rem 12rem auto" alignItems="center" gap="3" px="3" py="1.5"
    borderBottomWidth="1px" borderColor="border.muted" _hover={{ bg: 'bg.muted' }} cursor="pointer" onClick={() => onOpen(issue.id)}
    opacity={board.pending.has(issue.id) || issue.number === null ? 0.6 : 1}>
    <Text fontFamily="mono" fontSize="sm" color="fg.subtle" textAlign="end">{issue.number ?? '··'}</Text>
    <chakra.button textAlign="start" fontSize="sm" fontWeight="medium" truncate aria-label={`Open #${issue.number}: ${issue.title}`}>{issue.title}</chakra.button>
    <Text fontSize="xs" color="fg.muted" truncate>{issue.feature}{issue.location !== '.' ? ` in ${issue.location}` : ''}</Text>
    <Box mt="-1.5"><DependencyChips issue={issue} issues={board.issues} /></Box>
    <Box onClick={(event) => event.stopPropagation()}><StatusMenu issue={issue} board={board} /></Box>
  </Box>;
}

function CommandPalette({ open, onClose, board, onPick }: { open: boolean; onClose: () => void; board: ProtoBoard; onPick: (entry: Entry) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);
  const q = query.trim().toLowerCase();
  const results: { entry: Entry; label: string; hint: string; icon: ReactNode }[] = [
    ...board.issues.filter((issue) => issue.number && (!q || `${issue.number} ${issue.title} ${issue.content ?? ''}`.toLowerCase().includes(q)))
      .map((issue) => ({ entry: { kind: 'issue' as const, id: issue.id }, label: `${issue.title}`, hint: `#${issue.number} · ${issue.feature}`, icon: <StatusDot status={issue.status} /> })),
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

export function VariantC({ board, recovery, clearRecovery, reportOpen }: VariantProps) {
  const [workflow, setWorkflow] = useState<Workflow>('implementation');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [view, setView] = useState('list');
  const [palette, setPalette] = useState(false);
  const [creating, setCreating] = useState(false);
  const detail = useDetail(board, recovery, clearRecovery);
  useEffect(() => { reportOpen(detail.current?.kind === 'issue' ? detail.current.id : null); }, [detail.current]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette(true); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { board: issues } = filterIssues(board.issues, workflow, filters);
  const features = [...new Map(board.issues.filter((issue) => issue.workflow === workflow).map((issue) => [featureKey(issue), issue])).values()];
  const open = (id: string) => detail.open({ kind: 'issue', id });

  const header = <HStack as="header" px="6" h="14" gap="4" borderBottomWidth="1px" borderColor="border.muted" bg="bg.panel" flexShrink="0">
    <Text fontWeight="semibold" letterSpacing="-0.01em">md-kanban</Text>
    <Button variant="outline" size="sm" color="fg.muted" fontWeight="normal" w="sm" justifyContent="start" onClick={() => setPalette(true)}>
      <LuSearch />Search or jump to…<HStack ms="auto" gap="0.5"><Kbd size="sm">⌘</Kbd><Kbd size="sm">K</Kbd></HStack></Button>
    <HStack ms="auto" gap="3">
      <LiveIndicator live={board.live} />
      <AttentionPopover board={board} onOpen={open} />
      <ColorModeButton size="xs" />
      <Button size="sm" onClick={() => setCreating(true)}><LuPlus />New issue</Button>
    </HStack>
  </HStack>;

  if (detail.isOpen) return <Flex direction="column" h="100dvh">
    {header}
    <Box flex="1" overflowY="auto">
      <Box maxW="6xl" mx="auto" px="8" py="6">
        <HStack mb="6" gap="3">
          <Button size="sm" variant="ghost" ms="-3" onClick={detail.stack.length > 1 ? detail.back : detail.close}><LuArrowLeft />{detail.stack.length > 1 ? 'Back' : 'Board'}</Button>
          <DetailBreadcrumb detail={detail} board={board} />
        </HStack>
        <DetailContent detail={detail} board={board} layout="split" />
      </Box>
    </Box>
    {detail.discardDialog}
    <CommandPalette open={palette} onClose={() => setPalette(false)} board={board} onPick={(entry) => detail.open(entry)} />
    <CreateIssueDialog open={creating} onClose={() => setCreating(false)} board={board} workflow={workflow} />
  </Flex>;

  return <Flex direction="column" h="100dvh">
    {header}
    <HStack px="6" py="3" gap="3" flexShrink="0" wrap="wrap">
      <SegmentGroup.Root size="sm" value={workflow} onValueChange={(event) => { if (event.value) { setWorkflow(event.value as Workflow); setFilters(noFilters); } }}>
        <SegmentGroup.Indicator /><SegmentGroup.Items items={[{ value: 'implementation', label: 'Implementation' }, { value: 'wayfinding', label: 'Wayfinding' }]} />
      </SegmentGroup.Root>
      <NativeSelect.Root size="sm" width="60"><NativeSelect.Field aria-label={scopeLabel(workflow)} value={filters.feature} onChange={(event) => setFilters({ ...filters, feature: event.target.value })}>
        <option value="">All {workflow === 'wayfinding' ? 'efforts' : 'features'}</option>
        {features.map((issue) => <option key={featureKey(issue)} value={featureKey(issue)}>{issue.feature} ({issue.location})</option>)}
      </NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
      <Input size="sm" w="56" type="search" placeholder="Filter this list" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
      <SegmentGroup.Root size="sm" ms="auto" value={view} onValueChange={(event) => { if (event.value) setView(event.value); }}>
        <SegmentGroup.Indicator />
        <SegmentGroup.Items items={[{ value: 'list', label: <HStack gap="1.5"><LuList />List</HStack> }, { value: 'board', label: <HStack gap="1.5"><LuColumns3 />Board</HStack> }]} />
      </SegmentGroup.Root>
    </HStack>
    <Box px="6" flex="1" minH="0" overflow="auto">
      {issues.length === 0 ? <BoardEmpty workflow={workflow} filtered={!!filters.query || !!filters.feature} onClear={() => setFilters(noFilters)} />
        : view === 'board' ? <KanbanColumns issues={issues} workflow={workflow} board={board} onOpen={open} />
        : <Stack gap="4" pb="10" maxW="7xl">{statusesFor(workflow).map((status) => {
            const rows = issues.filter((issue) => issue.status === status);
            return <Collapsible.Root key={status} defaultOpen={rows.length > 0}>
              <Collapsible.Trigger asChild><chakra.button display="flex" alignItems="center" gap="2" w="full" py="1.5" px="1" borderBottomWidth="1px" borderColor="border">
                <Icon color="fg.muted" transition="transform 120ms" css={{ '[data-state=closed] &': { transform: 'rotate(-90deg)' } }}><LuChevronDown /></Icon>
                <StatusDot status={status}><Text fontSize="sm" fontWeight="semibold">{status}</Text></StatusDot>
                <Text fontFamily="mono" fontSize="xs" color="fg.muted">{rows.length}</Text>
              </chakra.button></Collapsible.Trigger>
              <Collapsible.Content>{rows.map((issue) => <Row key={issue.id} issue={issue} board={board} onOpen={open} />)}
                {rows.length === 0 && <Text fontSize="xs" color="fg.subtle" px="3" py="2">Nothing here.</Text>}</Collapsible.Content>
            </Collapsible.Root>;
          })}</Stack>}
    </Box>
    {detail.discardDialog}
    <CommandPalette open={palette} onClose={() => setPalette(false)} board={board} onPick={(entry) => detail.open(entry)} />
    <CreateIssueDialog open={creating} onClose={() => setCreating(false)} board={board} workflow={workflow} />
  </Flex>;
}

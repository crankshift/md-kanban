// PROTOTYPE — throwaway. Variant C: dense list grouped by status (board optional), full-page details, ⌘K palette to search and jump.
import { useEffect, useState } from 'react';
import { Box, Button, Flex, HStack, Input, Kbd, SegmentGroup, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuColumns3, LuList, LuPlus, LuSearch } from 'react-icons/lu';
import type { Workflow } from '../../server/board.js';
import { ColorModeButton } from '../components/ui/color-mode';
import { featureKey, filterIssues, noFilters, scopeLabel, type Filters } from './data';
import {
  AttentionPopover, AutoSelect, BoardEmpty, CommandPalette, CreateIssueDialog, DetailBreadcrumb, DetailContent, KanbanColumns, LiveIndicator,
  StatusList, useDetail, useHotkey,
} from './shared';
import type { VariantProps } from './PrototypeApp';

export const name = 'List + full page';

export function VariantC({ board, recovery, clearRecovery, reportOpen }: VariantProps) {
  const [workflow, setWorkflow] = useState<Workflow>('implementation');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [view, setView] = useState('list');
  const [palette, setPalette] = useState(false);
  const [creating, setCreating] = useState(false);
  const detail = useDetail(board, recovery, clearRecovery);
  useEffect(() => { reportOpen(detail.current?.kind === 'issue' ? detail.current.id : null); }, [detail.current]);
  useHotkey((event) => (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k', () => setPalette(true));
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
  const overlays = <>
    {detail.discardDialog}
    <CommandPalette open={palette} onClose={() => setPalette(false)} board={board} onPick={(entry) => detail.open(entry)} />
    <CreateIssueDialog open={creating} onClose={() => setCreating(false)} board={board} workflow={workflow} />
  </>;

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
    {overlays}
  </Flex>;

  return <Flex direction="column" h="100dvh">
    {header}
    <HStack px="6" py="3" gap="3" flexShrink="0" wrap="wrap">
      <SegmentGroup.Root size="sm" value={workflow} onValueChange={(event) => { if (event.value) { setWorkflow(event.value as Workflow); setFilters(noFilters); } }}>
        <SegmentGroup.Indicator /><SegmentGroup.Items items={[{ value: 'implementation', label: 'Implementation' }, { value: 'wayfinding', label: 'Wayfinding' }]} />
      </SegmentGroup.Root>
      <AutoSelect label={scopeLabel(workflow)} placeholder={`All ${workflow === 'wayfinding' ? 'efforts' : 'features'}`} width="16rem" clearable
        items={features.map((issue) => ({ value: featureKey(issue), label: `${issue.feature} (${issue.location})` }))}
        value={filters.feature} onChange={(feature) => setFilters({ ...filters, feature })} />
      <Input size="sm" w="56" type="search" placeholder="Filter this list" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
      <SegmentGroup.Root size="sm" ms="auto" value={view} onValueChange={(event) => { if (event.value) setView(event.value); }}>
        <SegmentGroup.Indicator />
        <SegmentGroup.Items items={[{ value: 'list', label: <HStack gap="1.5"><LuList />List</HStack> }, { value: 'board', label: <HStack gap="1.5"><LuColumns3 />Board</HStack> }]} />
      </SegmentGroup.Root>
    </HStack>
    <Box px="6" flex="1" minH="0" overflow="auto">
      {issues.length === 0 ? <BoardEmpty workflow={workflow} filtered={!!filters.query || !!filters.feature} onClear={() => setFilters(noFilters)} />
        : view === 'board' ? <KanbanColumns issues={issues} workflow={workflow} board={board} onOpen={open} />
        : <Box maxW="7xl"><StatusList issues={issues} workflow={workflow} board={board} onOpen={open} /></Box>}
    </Box>
    {overlays}
  </Flex>;
}

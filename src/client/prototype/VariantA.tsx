// PROTOTYPE — throwaway. Variant A: top bar + toolbar, full-width columns, details in an overlay drawer.
import { useEffect, useState } from 'react';
import { Box, Button, CloseButton, Drawer, Flex, HStack, IconButton, Input, InputGroup, Menu, NativeSelect, Portal, SegmentGroup, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuBookOpen, LuPlus, LuSearch } from 'react-icons/lu';
import type { Workflow } from '../../server/board.js';
import { ColorModeButton } from '../components/ui/color-mode';
import { featureKey, filterIssues, noFilters, scopeLabel, type Filters } from './data';
import {
  AttentionPopover, BoardEmpty, CreateIssueDialog, DetailBreadcrumb, DetailContent, documentGroups, documentIcon, KanbanColumns, LiveIndicator, useDetail,
} from './shared';
import type { VariantProps } from './PrototypeApp';

export const name = 'Top bar + drawer';

export function VariantA({ board, recovery, clearRecovery, reportOpen }: VariantProps) {
  const [workflow, setWorkflow] = useState<Workflow>('implementation');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [creating, setCreating] = useState(false);
  const detail = useDetail(board, recovery, clearRecovery);
  useEffect(() => { reportOpen(detail.current?.kind === 'issue' ? detail.current.id : null); }, [detail.current]);
  const { board: issues } = filterIssues(board.issues, workflow, filters);
  const filtered = filters !== noFilters && (!!filters.query || !!filters.location || !!filters.feature);
  const locations = [...new Set(board.issues.map((issue) => issue.location))].sort();
  const features = [...new Map(board.issues.filter((issue) => issue.workflow === workflow && (!filters.location || issue.location === filters.location))
    .map((issue) => [featureKey(issue), issue])).values()];

  return <Flex direction="column" h="100dvh">
    <HStack as="header" px="5" h="14" gap="4" borderBottomWidth="1px" borderColor="border.muted" bg="bg.panel" flexShrink="0">
      <Text fontWeight="semibold" letterSpacing="-0.01em">md-kanban</Text>
      <Text fontFamily="mono" fontSize="xs" color="fg.muted" truncate maxW="md">{board.folder}</Text>
      <HStack ms="auto" gap="3">
        <LiveIndicator live={board.live} />
        <AttentionPopover board={board} onOpen={(id) => detail.open({ kind: 'issue', id })} />
        <Menu.Root onSelect={(details) => detail.open({ kind: 'doc', path: details.value, fragment: null })}>
          <Menu.Trigger asChild><Button size="xs" variant="ghost"><LuBookOpen />Documents</Button></Menu.Trigger>
          <Portal><Menu.Positioner><Menu.Content maxH="80vh" overflowY="auto" minW="72">
            {documentGroups.map(([kind, label]) => {
              const docs = board.documents.filter((doc) => doc.kind === kind);
              return docs.length > 0 && <Menu.ItemGroup key={kind}><Menu.ItemGroupLabel>{label}</Menu.ItemGroupLabel>
                {docs.map((doc) => <Menu.Item key={doc.path} value={doc.path}>{documentIcon(doc.kind)}<Text truncate>{doc.title}</Text></Menu.Item>)}
              </Menu.ItemGroup>;
            })}
          </Menu.Content></Menu.Positioner></Portal>
        </Menu.Root>
        <ColorModeButton size="xs" />
        <Button size="sm" onClick={() => setCreating(true)}><LuPlus />New issue</Button>
      </HStack>
    </HStack>

    <HStack px="5" py="3" gap="3" wrap="wrap" flexShrink="0">
      <SegmentGroup.Root size="sm" value={workflow} onValueChange={(event) => { if (event.value) { setWorkflow(event.value as Workflow); setFilters({ ...filters, feature: '' }); } }}>
        <SegmentGroup.Indicator />
        <SegmentGroup.Items items={[{ value: 'implementation', label: 'Implementation' }, { value: 'wayfinding', label: 'Wayfinding' }]} />
      </SegmentGroup.Root>
      <InputGroup startElement={<LuSearch />} maxW="xs" flex="1">
        <Input size="sm" type="search" placeholder="Search titles and bodies" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
      </InputGroup>
      <NativeSelect.Root size="sm" width="44"><NativeSelect.Field aria-label="Location" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value, feature: '' })}>
        <option value="">All locations</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}
      </NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
      <NativeSelect.Root size="sm" width="56"><NativeSelect.Field aria-label={scopeLabel(workflow)} value={filters.feature} onChange={(event) => setFilters({ ...filters, feature: event.target.value })}>
        <option value="">All {workflow === 'wayfinding' ? 'efforts' : 'features'}</option>
        {features.map((issue) => <option key={featureKey(issue)} value={featureKey(issue)}>{issue.feature}{locations.length > 1 ? ` (${issue.location})` : ''}</option>)}
      </NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
      {filtered && <Button size="sm" variant="ghost" onClick={() => setFilters(noFilters)}>Clear</Button>}
    </HStack>

    <Box px="5" flex="1" minH="0" overflow="auto">
      {issues.length === 0 ? <BoardEmpty workflow={workflow} filtered={filtered} onClear={() => setFilters(noFilters)} />
        : <KanbanColumns issues={issues} workflow={workflow} board={board} onOpen={(id) => detail.open({ kind: 'issue', id })} />}
    </Box>

    <Drawer.Root open={detail.isOpen} onOpenChange={(event) => { if (!event.open) detail.close(); }} size="lg" placement="end">
      <Portal><Drawer.Backdrop /><Drawer.Positioner><Drawer.Content>
        <Drawer.Header borderBottomWidth="1px" borderColor="border.muted" py="3">
          <HStack gap="2" minW="0">
            {detail.stack.length > 1 && <IconButton size="xs" variant="ghost" aria-label="Back" onClick={detail.back}><LuArrowLeft /></IconButton>}
            {detail.stack.length > 1 ? <DetailBreadcrumb detail={detail} board={board} /> : <Drawer.Title fontSize="sm" color="fg.muted" fontWeight="normal">
              {detail.current?.kind === 'doc' ? 'Document' : 'Issue'}</Drawer.Title>}
          </HStack>
        </Drawer.Header>
        <Drawer.Body py="5"><DetailContent detail={detail} board={board} /></Drawer.Body>
        <Drawer.CloseTrigger asChild><CloseButton size="sm" /></Drawer.CloseTrigger>
      </Drawer.Content></Drawer.Positioner></Portal>
    </Drawer.Root>
    {detail.discardDialog}
    <CreateIssueDialog open={creating} onClose={() => setCreating(false)} board={board} workflow={workflow} />
  </Flex>;
}

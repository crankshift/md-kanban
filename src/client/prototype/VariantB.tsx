// PROTOTYPE — throwaway. Variant B: navigator sidebar (collapsible to an icon rail with `[`), board or list in main,
// details in a centered dialog, ⌘K to search and jump.
import { useEffect, useState, type ReactNode } from 'react';
import { Badge, Box, Button, chakra, CloseButton, Dialog, Flex, Float, Heading, HStack, IconButton, Input, InputGroup, Kbd, Menu, Portal, SegmentGroup, Stack, Text } from '@chakra-ui/react';
import {
  LuArrowLeft, LuBookOpen, LuColumns3, LuCompass, LuKanban, LuList, LuPanelLeftClose, LuPanelLeftOpen, LuPlus, LuSearch, LuTriangleAlert,
} from 'react-icons/lu';
import type { Workflow } from '../../server/board.js';
import { ColorModeButton } from '../components/ui/color-mode';
import { Tooltip } from '../components/ui/tooltip';
import { featureKey, filterIssues, noFilters, scopeLabel, type Filters } from './data';
import {
  BoardEmpty, CommandPalette, CreateIssueDialog, DetailBreadcrumb, DetailContent, documentGroups, documentIcon, KanbanColumns, LiveIndicator,
  StatusList, useDetail, useHotkey,
} from './shared';
import type { VariantProps } from './PrototypeApp';

export const name = 'Sidebar + dialog, board or list';

const workflowIcon = { implementation: <LuKanban />, wayfinding: <LuCompass /> } as const;

function NavItem({ active, onClick, children, count, indent = 0 }: { active?: boolean; onClick: () => void; children: ReactNode; count?: number; indent?: number }) {
  return <chakra.button display="flex" alignItems="center" gap="2" w="full" textAlign="start" fontSize="sm" py="1" px="2" ps={`${0.5 + indent * 0.9}rem`} rounded="l2"
    bg={active ? 'colorPalette.subtle' : undefined} color={active ? 'colorPalette.fg' : 'fg'} fontWeight={active ? 'medium' : 'normal'}
    _hover={{ bg: active ? 'colorPalette.subtle' : 'bg.muted' }} aria-current={active ? 'true' : undefined} onClick={onClick}>
    <Box flex="1" minW="0" truncate display="flex" alignItems="center" gap="2">{children}</Box>
    {count !== undefined && <Text fontFamily="mono" fontSize="xs" color="fg.muted">{count}</Text>}
  </chakra.button>;
}

function RailButton({ label, active, onClick, children, badge }: { label: string; active?: boolean; onClick?: () => void; children: ReactNode; badge?: number }) {
  return <Tooltip content={label} positioning={{ placement: 'right' }}>
    <IconButton aria-label={label} size="sm" variant={active ? 'subtle' : 'ghost'} color={active ? 'colorPalette.fg' : 'fg.muted'} position="relative" onClick={onClick}>
      {children}
      {!!badge && <Float placement="top-end" offset="1"><Badge size="xs" variant="solid" colorPalette="yellow" rounded="full" px="1">{badge}</Badge></Float>}
    </IconButton>
  </Tooltip>;
}

const SectionLabel = ({ children }: { children: ReactNode }) => <Text fontSize="xs" color="fg.muted" fontWeight="medium" px="2" pt="4" pb="1">{children}</Text>;

export function VariantB({ board, recovery, clearRecovery, reportOpen }: VariantProps) {
  const [workflow, setWorkflow] = useState<Workflow>('implementation');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [view, setView] = useState('board');
  const [collapsed, setCollapsed] = useState(false);
  const [showAttention, setShowAttention] = useState(false);
  const [palette, setPalette] = useState(false);
  const [creating, setCreating] = useState(false);
  const detail = useDetail(board, recovery, clearRecovery);
  useEffect(() => { reportOpen(detail.current?.kind === 'issue' ? detail.current.id : null); }, [detail.current]);
  useHotkey((event) => (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k', () => setPalette(true));
  useHotkey((event) => event.key === '[' && !event.metaKey && !event.ctrlKey, () => setCollapsed((value) => !value));

  const { board: issues, attention } = filterIssues(board.issues, workflow, filters);
  const inWorkflow = board.issues.filter((issue) => issue.workflow === workflow && issue.diagnostics.length === 0);
  const locations = [...new Set(inWorkflow.map((issue) => issue.location))].sort();
  const featuresIn = (location: string) => [...new Map(inWorkflow.filter((issue) => issue.location === location).map((issue) => [featureKey(issue), issue])).values()];
  const countWorkflow = (value: Workflow) => board.issues.filter((issue) => issue.workflow === value && issue.diagnostics.length === 0).length;
  const scope = filters.feature ? inWorkflow.find((issue) => featureKey(issue) === filters.feature) : null;
  const choose = (next: Filters) => { setFilters(next); setShowAttention(false); };
  const switchWorkflow = (value: Workflow) => { setWorkflow(value); choose(noFilters); };
  const openDoc = (path: string) => detail.open({ kind: 'doc', path, fragment: null });

  const sidebar = <Flex as="nav" direction="column" borderEndWidth="1px" borderColor="border.muted" bg="bg.panel" px="2" py="3" overflowY="auto" aria-label="Navigator">
    <HStack px="2" pb="1" justify="space-between">
      <Text fontWeight="semibold" letterSpacing="-0.01em">md-kanban</Text>
      <Tooltip content={<HStack>Collapse sidebar<Kbd size="sm">[</Kbd></HStack>}>
        <IconButton aria-label="Collapse sidebar" size="xs" variant="ghost" color="fg.muted" onClick={() => setCollapsed(true)}><LuPanelLeftClose /></IconButton>
      </Tooltip>
    </HStack>
    <Text px="2" fontFamily="mono" fontSize="xs" color="fg.muted" wordBreak="break-all" lineClamp="2">{board.folder}</Text>
    <Button mt="3" mx="1" size="sm" variant="outline" color="fg.muted" fontWeight="normal" justifyContent="start" onClick={() => setPalette(true)}>
      <LuSearch />Jump to…<HStack ms="auto" gap="0.5"><Kbd size="sm">⌘</Kbd><Kbd size="sm">K</Kbd></HStack></Button>

    <SectionLabel>Workflow</SectionLabel>
    {(['implementation', 'wayfinding'] as const).map((value) => <NavItem key={value} active={workflow === value && !showAttention} count={countWorkflow(value)}
      onClick={() => switchWorkflow(value)}><Box color="fg.muted">{workflowIcon[value]}</Box>{value === 'implementation' ? 'Implementation' : 'Wayfinding'}</NavItem>)}
    {attention.length > 0 && <NavItem active={showAttention} count={attention.length} onClick={() => setShowAttention(true)}>
      <Box color="fg.warning"><LuTriangleAlert /></Box>Needs attention</NavItem>}

    <SectionLabel>{workflow === 'wayfinding' ? 'Efforts' : 'Features'}</SectionLabel>
    <NavItem active={!filters.feature && !filters.location && !showAttention} count={inWorkflow.length} onClick={() => choose({ ...filters, location: '', feature: '' })}>All</NavItem>
    {locations.map((location) => <Box key={location}>
      {locations.length > 1 && <NavItem active={filters.location === location && !filters.feature && !showAttention} onClick={() => choose({ ...filters, location, feature: '' })}>
        <Text fontFamily="mono" fontSize="xs" color="fg.muted">{location}</Text></NavItem>}
      {featuresIn(location).map((issue) => <NavItem key={featureKey(issue)} indent={locations.length > 1 ? 1 : 0} active={filters.feature === featureKey(issue) && !showAttention}
        count={inWorkflow.filter((candidate) => featureKey(candidate) === featureKey(issue)).length}
        onClick={() => choose({ ...filters, location: issue.location, feature: featureKey(issue) })}>{issue.feature}</NavItem>)}
    </Box>)}

    {documentGroups.map(([kind, label]) => {
      const docs = board.documents.filter((doc) => doc.kind === kind);
      return docs.length > 0 && <Box key={kind}><SectionLabel>{label}</SectionLabel>
        {docs.map((doc) => <NavItem key={doc.path} onClick={() => openDoc(doc.path)}>
          <Box color="fg.muted" flexShrink="0">{documentIcon(doc.kind)}</Box><Text truncate>{doc.title}</Text></NavItem>)}
      </Box>;
    })}
    <HStack mt="auto" pt="4" px="2" justify="space-between"><LiveIndicator live={board.live} /><ColorModeButton size="xs" /></HStack>
  </Flex>;

  // Collapsed: the same destinations as icons, so nothing becomes unreachable.
  const rail = <Flex as="nav" direction="column" align="center" gap="1" borderEndWidth="1px" borderColor="border.muted" bg="bg.panel" py="3" aria-label="Navigator">
    <RailButton label="Expand sidebar  [" onClick={() => setCollapsed(false)}><LuPanelLeftOpen /></RailButton>
    <RailButton label="Jump to…  ⌘K" onClick={() => setPalette(true)}><LuSearch /></RailButton>
    <Box h="1px" w="6" bg="border.muted" my="2" />
    <RailButton label={`Implementation (${countWorkflow('implementation')})`} active={workflow === 'implementation' && !showAttention} onClick={() => switchWorkflow('implementation')}>{workflowIcon.implementation}</RailButton>
    <RailButton label={`Wayfinding (${countWorkflow('wayfinding')})`} active={workflow === 'wayfinding' && !showAttention} onClick={() => switchWorkflow('wayfinding')}>{workflowIcon.wayfinding}</RailButton>
    {attention.length > 0 && <RailButton label="Needs attention" active={showAttention} badge={attention.length} onClick={() => setShowAttention(true)}><LuTriangleAlert /></RailButton>}
    <Menu.Root positioning={{ placement: 'right-start' }} onSelect={(details) => openDoc(details.value)}>
      <Menu.Trigger asChild><IconButton aria-label="Documents" size="sm" variant="ghost" color="fg.muted"><LuBookOpen /></IconButton></Menu.Trigger>
      <Portal><Menu.Positioner><Menu.Content maxH="80vh" overflowY="auto" minW="72">
        {documentGroups.map(([kind, label]) => {
          const docs = board.documents.filter((doc) => doc.kind === kind);
          return docs.length > 0 && <Menu.ItemGroup key={kind}><Menu.ItemGroupLabel>{label}</Menu.ItemGroupLabel>
            {docs.map((doc) => <Menu.Item key={doc.path} value={doc.path}>{documentIcon(doc.kind)}<Text truncate>{doc.title}</Text></Menu.Item>)}
          </Menu.ItemGroup>;
        })}
      </Menu.Content></Menu.Positioner></Portal>
    </Menu.Root>
    <Stack mt="auto" align="center" gap="2"><LiveIndicator live={board.live} /><ColorModeButton size="xs" /></Stack>
  </Flex>;

  const title = showAttention ? 'Needs attention' : scope?.feature ?? (filters.location || `All ${workflow === 'wayfinding' ? 'efforts' : 'features'}`);
  const context = showAttention ? 'Files that need a look' : scope ? `${scopeLabel(workflow)}${locations.length > 1 ? ` in ${scope.location}` : ''}` : workflow === 'implementation' ? 'Implementation' : 'Wayfinding';
  const open = (id: string) => detail.open({ kind: 'issue', id });

  return <Box display="grid" gridTemplateColumns={collapsed ? '3.25rem minmax(0, 1fr)' : '16rem minmax(0, 1fr)'} h="100dvh" transition="grid-template-columns 160ms ease">
    {collapsed ? rail : sidebar}
    <Flex direction="column" minW="0" minH="0">
      <HStack px="6" pt="5" pb="3" gap="4" flexShrink="0">
        <Stack gap="0" minW="0">
          <Text fontSize="xs" color="fg.muted">{context}</Text>
          <Heading size="lg" truncate>{title}</Heading>
        </Stack>
        <HStack ms="auto" gap="2">
          {!showAttention && <InputGroup startElement={<LuSearch />} w="60">
            <Input size="sm" type="search" placeholder="Filter titles and bodies" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
          </InputGroup>}
          {!showAttention && <SegmentGroup.Root size="sm" value={view} onValueChange={(event) => { if (event.value) setView(event.value); }}>
            <SegmentGroup.Indicator />
            <SegmentGroup.Items items={[{ value: 'board', label: <HStack gap="1.5"><LuColumns3 />Board</HStack> }, { value: 'list', label: <HStack gap="1.5"><LuList />List</HStack> }]} />
          </SegmentGroup.Root>}
          <Button size="sm" onClick={() => setCreating(true)}><LuPlus />New issue</Button>
        </HStack>
      </HStack>
      <Box px="6" flex="1" minH="0" overflow="auto">
        {showAttention ? <Stack gap="2" maxW="3xl">{attention.map((issue) => <Box key={issue.id} as="button" textAlign="start" p="3" rounded="l2" borderWidth="1px" borderColor="border.muted" bg="bg.panel"
            _hover={{ borderColor: 'border.emphasized' }} onClick={() => open(issue.id)}>
            <HStack><Text fontFamily="mono" fontSize="xs">{issue.path}</Text><Badge size="xs" colorPalette="yellow" ms="auto">{issue.diagnostics.length} problem{issue.diagnostics.length > 1 ? 's' : ''}</Badge></HStack>
            {issue.diagnostics.map((reason) => <Text key={reason} fontSize="sm" color="fg.muted" mt="1">{reason}</Text>)}
          </Box>)}</Stack>
          : issues.length === 0 ? <BoardEmpty workflow={workflow} filtered={!!filters.query || !!filters.feature} onClear={() => setFilters(noFilters)} />
          : view === 'list' ? <Box maxW="7xl"><StatusList issues={issues} workflow={workflow} board={board} onOpen={open} showFeature={!filters.feature} /></Box>
          : <KanbanColumns issues={issues} workflow={workflow} board={board} showFeature={!filters.feature} onOpen={open} />}
      </Box>
    </Flex>

    <Dialog.Root open={detail.isOpen} onOpenChange={(event) => { if (!event.open) detail.close(); }} size="xl" placement="center" scrollBehavior="inside">
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content minH="70vh">
        <Dialog.Header py="3" borderBottomWidth="1px" borderColor="border.muted">
          <HStack gap="2" minW="0">
            {detail.stack.length > 1 && <IconButton size="xs" variant="ghost" aria-label="Back" onClick={detail.back}><LuArrowLeft /></IconButton>}
            {detail.stack.length > 1 ? <DetailBreadcrumb detail={detail} board={board} />
              : <Dialog.Title fontSize="sm" color="fg.muted" fontWeight="normal">{detail.current?.kind === 'doc' ? 'Document' : 'Issue'}</Dialog.Title>}
          </HStack>
        </Dialog.Header>
        <Dialog.Body py="6" px="8"><DetailContent detail={detail} board={board} layout="split" /></Dialog.Body>
        <Dialog.CloseTrigger asChild><CloseButton size="sm" /></Dialog.CloseTrigger>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
    {detail.discardDialog}
    <CommandPalette open={palette} onClose={() => setPalette(false)} board={board} onPick={(entry) => detail.open(entry)} />
    <CreateIssueDialog open={creating} onClose={() => setCreating(false)} board={board} workflow={workflow} />
  </Box>;
}

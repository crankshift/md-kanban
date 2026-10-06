// PROTOTYPE — throwaway. Variant B: navigator sidebar (workflow, locations → features, documents), board in main, details in a centered dialog.
import { useEffect, useState, type ReactNode } from 'react';
import { Badge, Box, Button, chakra, CloseButton, Dialog, Flex, Heading, HStack, IconButton, Input, InputGroup, Portal, Stack, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuPlus, LuSearch, LuTriangleAlert } from 'react-icons/lu';
import type { Workflow } from '../../server/board.js';
import { ColorModeButton } from '../components/ui/color-mode';
import { featureKey, filterIssues, noFilters, scopeLabel, type Filters } from './data';
import { BoardEmpty, CreateIssueDialog, DetailBreadcrumb, DetailContent, documentGroups, documentIcon, KanbanColumns, LiveIndicator, useDetail } from './shared';
import type { VariantProps } from './PrototypeApp';

export const name = 'Sidebar + dialog';

function NavItem({ active, onClick, children, count, indent = 0 }: { active?: boolean; onClick: () => void; children: ReactNode; count?: number; indent?: number }) {
  return <chakra.button display="flex" alignItems="center" gap="2" w="full" textAlign="start" fontSize="sm" py="1" px="2" ps={`${0.5 + indent * 0.9}rem`} rounded="l2"
    bg={active ? 'colorPalette.subtle' : undefined} color={active ? 'colorPalette.fg' : 'fg'} fontWeight={active ? 'medium' : 'normal'}
    _hover={{ bg: active ? 'colorPalette.subtle' : 'bg.muted' }} aria-current={active ? 'true' : undefined} onClick={onClick}>
    <Box flex="1" minW="0" truncate display="flex" alignItems="center" gap="2">{children}</Box>
    {count !== undefined && <Text fontFamily="mono" fontSize="xs" color="fg.muted">{count}</Text>}
  </chakra.button>;
}

const SectionLabel = ({ children }: { children: ReactNode }) => <Text fontSize="xs" color="fg.muted" fontWeight="medium" px="2" pt="4" pb="1">{children}</Text>;

export function VariantB({ board, recovery, clearRecovery, reportOpen }: VariantProps) {
  const [workflow, setWorkflow] = useState<Workflow>('implementation');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [showAttention, setShowAttention] = useState(false);
  const [creating, setCreating] = useState(false);
  const detail = useDetail(board, recovery, clearRecovery);
  useEffect(() => { reportOpen(detail.current?.kind === 'issue' ? detail.current.id : null); }, [detail.current]);
  const { board: issues, attention } = filterIssues(board.issues, workflow, filters);
  const inWorkflow = board.issues.filter((issue) => issue.workflow === workflow && issue.diagnostics.length === 0);
  const locations = [...new Set(inWorkflow.map((issue) => issue.location))].sort();
  const featuresIn = (location: string) => [...new Map(inWorkflow.filter((issue) => issue.location === location).map((issue) => [featureKey(issue), issue])).values()];
  const countWorkflow = (value: Workflow) => board.issues.filter((issue) => issue.workflow === value && issue.diagnostics.length === 0).length;
  const scope = filters.feature ? inWorkflow.find((issue) => featureKey(issue) === filters.feature) : null;
  const choose = (next: Filters) => { setFilters(next); setShowAttention(false); };

  return <Box display="grid" gridTemplateColumns="16rem minmax(0, 1fr)" h="100dvh">
    <Flex as="nav" direction="column" borderEndWidth="1px" borderColor="border.muted" bg="bg.panel" px="2" py="4" overflowY="auto" aria-label="Navigator">
      <Box px="2" pb="2">
        <Text fontWeight="semibold" letterSpacing="-0.01em">md-kanban</Text>
        <Text fontFamily="mono" fontSize="xs" color="fg.muted" wordBreak="break-all" lineClamp="2">{board.folder}</Text>
      </Box>
      <SectionLabel>Workflow</SectionLabel>
      {(['implementation', 'wayfinding'] as const).map((value) => <NavItem key={value} active={workflow === value && !showAttention} count={countWorkflow(value)}
        onClick={() => { setWorkflow(value); choose(noFilters); }}>{value === 'implementation' ? 'Implementation' : 'Wayfinding'}</NavItem>)}
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
          {docs.map((doc) => <NavItem key={doc.path} onClick={() => detail.open({ kind: 'doc', path: doc.path, fragment: null })}>
            <Box color="fg.muted" flexShrink="0">{documentIcon(doc.kind)}</Box><Text truncate>{doc.title}</Text></NavItem>)}
        </Box>;
      })}
      <HStack mt="auto" pt="4" px="2" justify="space-between"><LiveIndicator live={board.live} /><ColorModeButton size="xs" /></HStack>
    </Flex>

    <Flex direction="column" minW="0" minH="0">
      <HStack px="6" pt="5" pb="3" gap="4" flexShrink="0">
        <Stack gap="0" minW="0">
          <Text fontSize="xs" color="fg.muted">{showAttention ? 'Files that need a look' : scope ? `${scopeLabel(workflow)}${locations.length > 1 ? ` in ${scope.location}` : ''}` : workflow === 'implementation' ? 'Implementation' : 'Wayfinding'}</Text>
          <Heading size="lg" truncate>{showAttention ? 'Needs attention' : scope?.feature ?? (filters.location ? filters.location : `All ${workflow === 'wayfinding' ? 'efforts' : 'features'}`)}</Heading>
        </Stack>
        <HStack ms="auto" gap="2">
          <InputGroup startElement={<LuSearch />} w="64">
            <Input size="sm" type="search" placeholder="Search titles and bodies" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
          </InputGroup>
          <Button size="sm" onClick={() => setCreating(true)}><LuPlus />New issue</Button>
        </HStack>
      </HStack>
      <Box px="6" flex="1" minH="0" overflow="auto">
        {showAttention ? <Stack gap="2" maxW="3xl">{attention.map((issue) => <Box key={issue.id} as="button" textAlign="start" p="3" rounded="l2" borderWidth="1px" borderColor="border.muted" bg="bg.panel"
            _hover={{ borderColor: 'border.emphasized' }} onClick={() => detail.open({ kind: 'issue', id: issue.id })}>
            <HStack><Text fontFamily="mono" fontSize="xs">{issue.path}</Text><Badge size="xs" colorPalette="yellow" ms="auto">{issue.diagnostics.length} problem{issue.diagnostics.length > 1 ? 's' : ''}</Badge></HStack>
            {issue.diagnostics.map((reason) => <Text key={reason} fontSize="sm" color="fg.muted" mt="1">{reason}</Text>)}
          </Box>)}</Stack>
          : issues.length === 0 ? <BoardEmpty workflow={workflow} filtered={!!filters.query || !!filters.feature} onClear={() => setFilters(noFilters)} />
          : <KanbanColumns issues={issues} workflow={workflow} board={board} showFeature={!filters.feature} onOpen={(id) => detail.open({ kind: 'issue', id })} />}
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
    <CreateIssueDialog open={creating} onClose={() => setCreating(false)} board={board} workflow={workflow} />
  </Box>;
}

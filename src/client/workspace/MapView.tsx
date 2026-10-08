import { lazy, Suspense } from 'react';
import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { Picker } from '../Picker';
import { labelOf, type Document, type MapSettings } from './model';
import type { DocumentRelation } from '../../server/document-types.js';

const DocumentMap = lazy(() => import('./DocumentMap').then((module) => ({ default: module.DocumentMap })));
export function MapView({ documents, edges, properties, selected, settings, onOpen, onSet }: {
  documents: Document[]; edges: DocumentRelation[]; properties: string[]; selected: string; settings: MapSettings;
  onOpen: (path: string) => void; onSet: (values: Record<string, string | null>) => void;
}) {
  const { mode, relation, presentation, connections, dependency } = settings;
  return <Box h="full" minH="280px" display="flex" flexDirection="column"><Box display="flex" alignItems="center" justifyContent="space-between" gap="2.5" flexWrap="wrap" py="2.5" px="4" bg="bg.panel" borderBottomWidth="1px"><HStack gap="1"><Button size="xs" aria-pressed={mode === 'global'} variant={mode === 'global' ? 'subtle' : 'ghost'} onClick={() => onSet({ map: 'global' })}>All files</Button><Button size="xs" aria-pressed={mode === 'local'} variant={mode === 'local' ? 'subtle' : 'ghost'} disabled={!selected} onClick={() => onSet({ map: 'local' })}>Neighborhood</Button></HStack>
    <HStack gap="1">{([['all', 'All relations'], ['link', 'Links'], ['dependency', 'Dependencies']] as const).map(([value, label]) => <Button key={value} size="xs" aria-pressed={relation === value} variant={relation === value ? 'subtle' : 'ghost'} onClick={() => onSet({ relation: value })}>{label}</Button>)}</HStack>
    <Box display="flex" alignItems="center" justifyContent="space-between" gap="2.5" flexWrap="wrap" w="full" borderTopWidth="1px" pt="2"><HStack gap="1" aria-label="Map layout">{mode === 'local' ? <Text fontSize="xs" color="fg.muted">Incoming / selected file / outgoing / two-way</Text> : (['overview', 'directed', 'folders'] as const).map((layout) => <Button key={layout} size="xs" variant={presentation === layout ? 'subtle' : 'ghost'} aria-pressed={presentation === layout} onClick={() => onSet({ layout })}>{labelOf(layout)}</Button>)}</HStack>
    <HStack gap="1"><Button size="xs" variant={connections === 'focus' ? 'subtle' : 'ghost'} aria-pressed={connections === 'focus'} onClick={() => onSet({ connections: 'focus' })}>Focus connections</Button><Button size="xs" variant={connections === 'all' ? 'subtle' : 'ghost'} aria-pressed={connections === 'all'} onClick={() => onSet({ connections: 'all' })}>All connections</Button></HStack></Box>
    <Box as="details" w="full" fontSize="10px" color="fg.muted" css={{ '& summary': { cursor: 'pointer', width: 'fit-content' } }}><summary>Dependency settings</summary><HStack align="end" gap="3" mt="3" mb="1"><Box w="180px"><Picker label="Dependency property" items={[{ value: '', label: 'None' }, ...properties.map((key) => ({ value: key, label: labelOf(key) }))]} value={[dependency]} onChange={(values) => onSet({ dependency: values[0] ?? '' })} /></Box><Text fontSize="xs" color="fg.muted">Only explicit file paths or links form dependencies.</Text></HStack></Box>
  </Box><Suspense fallback={<Text p="10" role="status">Loading document map…</Text>}><DocumentMap documents={documents} edges={edges} selected={selected} onOpen={onOpen} mode={mode} presentation={presentation} connections={connections} /></Suspense>
    <Text py="1.5" px="3.5" fontSize="10px" color="fg.muted" bg="bg.panel">{mode === 'local' ? 'One hop across the full collection. ' : 'Hover to preview connections; click to read. '}{presentation === 'directed' ? 'Arrows show references, not work order.' : 'Reciprocal references share a line; original directions stay in the reader.'} Dashed blue lines are dependencies.</Text>
  </Box>;
}

import { lazy, Suspense } from 'react';
import { Button, HStack, Text } from '@chakra-ui/react';
import { Picker } from '../Picker';
import { labelOf, type Document } from './model';
import type { DocumentRelation } from '../../server/document-types.js';

const DocumentMap = lazy(() => import('./DocumentMap').then((module) => ({ default: module.DocumentMap })));
export function MapView({ documents, edges, properties, selected, mode, relation, presentation, connections, dependency, onOpen, onSet }: {
  documents: Document[]; edges: DocumentRelation[]; properties: string[]; selected: string; mode: string; relation: string; presentation: string; connections: string; dependency: string;
  onOpen: (path: string) => void; onSet: (values: Record<string, string | null>) => void;
}) {
  return <div className="map-view"><div className="map-controls"><HStack gap="1"><Button size="xs" aria-pressed={mode === 'global'} variant={mode === 'global' ? 'subtle' : 'ghost'} onClick={() => onSet({ map: 'global' })}>All files</Button><Button size="xs" aria-pressed={mode === 'local'} variant={mode === 'local' ? 'subtle' : 'ghost'} disabled={!selected} onClick={() => onSet({ map: 'local' })}>Neighborhood</Button></HStack>
    <HStack gap="1">{([['all', 'All relations'], ['link', 'Links'], ['dependency', 'Dependencies']] as const).map(([value, label]) => <Button key={value} size="xs" aria-pressed={relation === value} variant={relation === value ? 'subtle' : 'ghost'} onClick={() => onSet({ relation: value })}>{label}</Button>)}</HStack>
    <div className="map-presentation"><HStack gap="1" aria-label="Map layout">{mode === 'local' ? <Text fontSize="xs" color="fg.muted">Incoming / selected file / outgoing / two-way</Text> : (['overview', 'directed', 'folders'] as const).map((layout) => <Button key={layout} size="xs" variant={presentation === layout ? 'subtle' : 'ghost'} aria-pressed={presentation === layout} onClick={() => onSet({ layout })}>{labelOf(layout)}</Button>)}</HStack>
    <HStack gap="1"><Button size="xs" variant={connections === 'focus' ? 'subtle' : 'ghost'} aria-pressed={connections === 'focus'} onClick={() => onSet({ connections: 'focus' })}>Focus connections</Button><Button size="xs" variant={connections === 'all' ? 'subtle' : 'ghost'} aria-pressed={connections === 'all'} onClick={() => onSet({ connections: 'all' })}>All connections</Button></HStack></div>
    <details className="dependency-options"><summary>Dependency settings</summary><div className="dependency-mapping"><Picker label="Dependency property" items={[{ value: '', label: 'None' }, ...properties.map((key) => ({ value: key, label: labelOf(key) }))]} value={[dependency]} onChange={(values) => onSet({ dependency: values[0] ?? '' })} /><Text fontSize="xs" color="fg.muted">Only explicit file paths or links form dependencies.</Text></div></details>
  </div><Suspense fallback={<p className="workspace-empty" role="status">Loading document map…</p>}><DocumentMap documents={documents} edges={edges} selected={selected} onOpen={onOpen} mode={mode} presentation={presentation} connections={connections} /></Suspense>
    <p className="map-neighborhood-note">{mode === 'local' ? 'One hop across the full collection. ' : 'Hover to preview connections; click to read. '}{presentation === 'directed' ? 'Arrows show references, not work order.' : 'Reciprocal references share a line; original directions stay in the reader.'} Dashed blue lines are dependencies.</p>
  </div>;
}

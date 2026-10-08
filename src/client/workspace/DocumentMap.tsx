// Read-only relationship canvas. Direction is data; layout is presentation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow, useInternalNode, useReactFlow, type Edge, type EdgeProps, type InternalNode, type NodeMouseHandler, type NodeProps, type OnNodesChange } from '@xyflow/react';
import { layoutDocumentMap, type DocumentNode, type FolderNode, type GraphNode } from './map-layout';
import { Box, Badge, Button, HStack, Text } from '@chakra-ui/react';
import { useColorMode } from '../components/ui/color-mode';
import { type Document, type MapSettings, propertyValue } from './model';
import type { DocumentRelation as Relation } from '../../server/document-types.js';
import '@xyflow/react/dist/style.css';

const valueOf = (document: Document, key: string) => document.properties.some((entry) => entry.key === key) ? propertyValue(document, key).label : '';

function MapNode({ data, selected }: NodeProps<DocumentNode>) {
  const document = data.document;
  return <Button variant="plain" className="document-node nodrag nopan" aria-label={`Read ${document.path}`} title={`${document.title}\n${document.path}`} onFocus={() => data.onFocus?.(document.path)} onBlur={() => data.onFocus?.('')} onClick={(event) => { event.stopPropagation(); data.onOpen?.(document.path); }} bg="bg.panel" color="fg" borderWidth={selected ? '2px' : '1px'} borderColor={selected ? 'orange.500' : data.compact ? 'transparent' : 'border.emphasized'} borderRadius="md" p="3" w="224px" h="auto" minH="72px" display="block" textAlign="start" whiteSpace="normal" _hover={{ borderColor: selected ? 'orange.500' : 'border.emphasized' }}>
    <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
    <HStack align="start" gap="2"><Box className="map-folder-dot" bg={data.color} w="2.5" h="2.5" rounded="full" mt="1" flexShrink="0" /><Box minW="0" flex="1">
      {!data.compact && <Text color="fg.muted" fontSize="10px" truncate mb="1">{document.folder}</Text>}
      <Text fontFamily="issueTitle" fontWeight="600" lineHeight="1.25" lineClamp="2" fontSize="15px">{document.title}</Text>
      {(valueOf(document, 'status') || valueOf(document, 'type')) && <Text fontSize="10px" color="fg.muted" mt="1" truncate>{[valueOf(document, 'status'), valueOf(document, 'type')].filter(Boolean).join(' / ')}</Text>}
      {!!document.diagnostics.length && <Badge size="xs" variant="outline" mt="1">File notice</Badge>}
    </Box></HStack>
    <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />
  </Button>;
}
function FolderGroup({ data }: NodeProps<FolderNode>) {
  return <Box h="full" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="lg" p="4"><HStack><Box bg={data.color} w="2" h="2" rounded="full" /><Text fontSize="12px" fontWeight="600">{data.label}</Text><Text fontSize="11px" color="fg.muted" ms="auto">{data.count}</Text></HStack></Box>;
}

// Attach straight links to the rectangle boundary, avoiding fixed left/right Bezier loops.
function boundary(node: InternalNode, other: InternalNode) {
  const width = node.measured.width ?? 224, height = node.measured.height ?? 80;
  const x = node.internals.positionAbsolute.x + width / 2, y = node.internals.positionAbsolute.y + height / 2;
  const dx = other.internals.positionAbsolute.x + (other.measured.width ?? 224) / 2 - x;
  const dy = other.internals.positionAbsolute.y + (other.measured.height ?? 80) / 2 - y;
  const scale = 1 / Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2), 0.001);
  return { x: x + dx * scale, y: y + dy * scale };
}
function FloatingLine({ id, source, target, style, markerStart, markerEnd }: EdgeProps) {
  const from = useInternalNode(source), to = useInternalNode(target);
  if (!from || !to) return null;
  const start = boundary(from, to), end = boundary(to, from);
  return <BaseEdge id={id} path={`M ${start.x},${start.y} L ${end.x},${end.y}`} style={style} {...(markerStart ? { markerStart } : {})} {...(markerEnd ? { markerEnd } : {})} />;
}
const nodeTypes = { document: MapNode, folder: FolderGroup };
const edgeTypes = { floating: FloatingLine };

function FitLayout({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => { void fitView({ padding: 0.12, maxZoom: 1 }); }, [signature, fitView]);
  return null;
}

export function DocumentMap({ documents, edges, selected, onOpen, mode, presentation, connections }: { documents: Document[]; edges: Relation[]; selected: string; onOpen: (path: string) => void; mode: MapSettings['mode']; presentation: MapSettings['presentation']; connections: MapSettings['connections'] }) {
  const { colorMode } = useColorMode();
  const [hovered, setHovered] = useState('');
  const measurements = useRef(new Map<string, { width: number; height: number }>());
  const handleNodesChange = useCallback<OnNodesChange<GraphNode>>((changes) => {
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) measurements.current.set(change.id, change.dimensions);
    }
  }, []);
  const handleEnter = useCallback<NodeMouseHandler<GraphNode>>((_event, node) => {
    if (node.type === 'document') setHovered(node.id);
  }, []);
  const handleLeave = useCallback<NodeMouseHandler<GraphNode>>(() => {
    setHovered('');
  }, []);
  const handleClick = useCallback<NodeMouseHandler<GraphNode>>((_event, node) => {
    if (node.type === 'document') onOpen(node.id);
  }, [onOpen]);
  const localCenter = mode === 'local' ? selected : '';
  const layout = useMemo(() => layoutDocumentMap(documents, edges, localCenter, presentation), [documents, edges, localCenter, presentation]);
  useEffect(() => {
    const available = new Set(layout.nodes.map((node) => node.id));
    for (const id of measurements.current.keys()) if (!available.has(id)) measurements.current.delete(id);
  }, [layout.nodes]);

  const available = new Set(documents.map((document) => document.path));
  const focus = available.has(hovered) ? hovered : available.has(selected) ? selected : '';
  const neighbors = new Set([focus]);
  for (const edge of layout.relations) if (edge.source === focus) neighbors.add(edge.target); else if (edge.target === focus) neighbors.add(edge.source);
  const shownPairs = layout.pairs.filter(([, edge]) => connections === 'all' || !focus || edge.source === focus || edge.target === focus);
  const graphEdges: Edge[] = shownPairs.map(([id, edge]) => {
    const related = !focus || edge.source === focus || edge.target === focus;
    const direction = presentation === 'directed' || !!localCenter || !!focus;
    const color = edge.kind === 'dependency' ? colorMode === 'dark' ? '#648dc2' : '#37669f' : focus && related ? colorMode === 'dark' ? '#df9247' : '#a85b17' : '#8494a4';
    const marker = { type: MarkerType.ArrowClosed, color, width: 14, height: 14 };
    return { id, source: edge.source, target: edge.target, type: 'floating', ariaLabel: `${edge.count} ${edge.kind} relationship${edge.count === 1 ? '' : 's'} between ${edge.source} and ${edge.target}`, ...(direction && edge.forward ? { markerEnd: marker } : {}), ...(direction && edge.reverse ? { markerStart: marker } : {}), style: { stroke: color, strokeWidth: focus && related ? 1.7 : 1, strokeDasharray: edge.kind === 'dependency' ? '5 4' : 'none', opacity: focus ? related ? 0.95 : 0.07 : 0.28 } };
  });
  // Keep React Flow's measured geometry when hover replaces controlled node objects.
  // Omitting it makes the library hide/re-measure the card and trigger another mouse leave.
  const graphNodes = layout.nodes.map((node): GraphNode => {
    const measured = measurements.current.get(node.id);
    const retained = measured ? { ...node, measured } : node;
    return retained.type === 'document' ? { ...retained, data: { ...retained.data, onOpen, onFocus: setHovered }, selected: retained.id === selected, style: { opacity: focus && !neighbors.has(retained.id) ? 0.24 : 1 } } : retained;
  });
  return <Box className="map-surface" flex="1" minH="200px" position="relative" aria-label={`${mode === 'local' ? 'Local' : 'Global'} document map`}>
    {!documents.length ? <Text p="10" color="fg.muted" textAlign="center">No files in this map. Clear filters or choose a file.</Text> : <ReactFlow<GraphNode>
      nodes={graphNodes} edges={graphEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      colorMode={colorMode} fitView fitViewOptions={{ padding: 0.12, maxZoom: 1 }} minZoom={0.1} maxZoom={2}
      onNodeClick={handleClick} onNodeMouseEnter={handleEnter} onNodeMouseLeave={handleLeave} onNodesChange={handleNodesChange}
      nodesFocusable={false} edgesFocusable={false} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false}
      deleteKeyCode={null} selectionKeyCode={null} panOnScroll preventScrolling zoomOnDoubleClick={false}>
      <FitLayout signature={JSON.stringify([mode, presentation, localCenter, !!selected])} />
      <Background gap={28} size={0.6} /><Controls showInteractive={false} />
    </ReactFlow>}
    <Text className="map-caption" position="absolute" bottom="2.5" left="15" zIndex="4" fontSize="10px" color="fg.muted" bg="bg.panel" py="1" px="2" borderWidth="1px" rounded="sm" maxW="calc(100% - 100px)">{documents.length} files · {shownPairs.length} connection{shownPairs.length === 1 ? '' : 's'} shown · {layout.relations.length} directed relationship{layout.relations.length === 1 ? '' : 's'}{focus ? ' · focused' : ''}</Text>
  </Box>;
}

import type { Node } from '@xyflow/react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import dagre from '@dagrejs/dagre';
import type { Document } from './model';
import type { DocumentRelation } from '../../server/document-types.js';

export type DocumentNode = Node<{ document: Document; color: string; compact: boolean; onOpen?: (path: string) => void; onFocus?: (path: string) => void }, 'document'>;
export type FolderNode = Node<{ label: string; count: number; color: string }, 'folder'>;
export type GraphNode = DocumentNode | FolderNode;
const colors = ['#6d87c7', '#55a093', '#a18bc2', '#b79a5e', '#7a9fae', '#aa7f8f'];
type Point = SimulationNodeDatum & { id: string; cluster: number };

/** Layouts arrange actual relationships; only the center's edges belong in its one-hop reading map. */
export function layoutDocumentMap(documents: Document[], edges: DocumentRelation[], localCenter: string, presentation: string) {

    const folders = [...new Set(documents.map((document) => document.folder))].sort();
    const available = new Set(documents.map((document) => document.path));
    const relations = edges.filter((edge) => available.has(edge.source) && available.has(edge.target) && (!localCenter || edge.source === localCenter || edge.target === localCenter));
    const nodes: GraphNode[] = [];
    const makeNode = (document: Document, x: number, y: number, compact: boolean): DocumentNode => ({ id: document.path, type: 'document', position: { x, y }, data: { document, compact, color: colors[folders.indexOf(document.folder) % colors.length]! } });
    const header = (id: string, label: string, count: number, x: number, y: number, width: number, height: number, color: string): FolderNode => ({ id, type: 'folder', position: { x, y }, data: { label, count, color }, style: { width, height }, selectable: false });

    if (localCenter && available.has(localCenter)) {
      const inbound = new Set(relations.filter((edge) => edge.target === localCenter).map((edge) => edge.source));
      const outbound = new Set(relations.filter((edge) => edge.source === localCenter).map((edge) => edge.target));
      const left = documents.filter((document) => inbound.has(document.path) && !outbound.has(document.path));
      const right = documents.filter((document) => outbound.has(document.path) && !inbound.has(document.path));
      const both = documents.filter((document) => inbound.has(document.path) && outbound.has(document.path));
      const middleY = Math.max(left.length, right.length, 1) * 55 + 60;
      for (const [label, entries, x] of [['Links here', left, 0], ['Links from here', right, 720]] as const) {
        nodes.push(header(`heading:${label}`, label, entries.length, x, 0, 250, 44, '#8a98a5'));
        entries.forEach((document, index) => nodes.push(makeNode(document, x + 12, 70 + index * 115, false)));
      }
      nodes.push(makeNode(documents.find((document) => document.path === localCenter)!, 360, middleY, false));
      if (both.length) {
        nodes.push(header('heading:both', 'Both directions', both.length, 0, middleY + 210, 200, 44, '#8a98a5'));
        both.forEach((document, index) => nodes.push(makeNode(document, 360 + (index - (both.length - 1) / 2) * 270, middleY + 210, false)));
      }
    } else if (presentation === 'folders') {
      let rowY = 0;
      for (let row = 0; row < Math.ceil(folders.length / 3); row++) {
        let height = 0;
        folders.slice(row * 3, row * 3 + 3).forEach((folder, column) => {
          const entries = documents.filter((document) => document.folder === folder);
          const group = header(`group:folder:${folder}`, folder, entries.length, column * 330, rowY, 286, 65 + entries.length * 92, colors[(row * 3 + column) % colors.length]!);
          nodes.push(group);
          entries.forEach((document, index) => nodes.push({ ...makeNode(document, 24, 54 + index * 92, true), parentId: group.id, extent: 'parent' }));
          height = Math.max(height, Number(group.style?.height));
        });
        rowY += height + 44;
      }
    } else {
      const connected = new Set(relations.flatMap((edge) => [edge.source, edge.target]));
      const active = documents.filter((document) => connected.has(document.path));
      const isolated = documents.filter((document) => !connected.has(document.path));
      if (presentation === 'directed') {
        const graph = new dagre.graphlib.Graph().setGraph({ rankdir: 'LR', nodesep: 35, ranksep: 110, marginx: 25, marginy: 25 });
        graph.setDefaultEdgeLabel(() => ({}));
        active.forEach((document) => graph.setNode(document.path, { width: 224, height: 110 }));
        relations.forEach((edge) => graph.setEdge(edge.source, edge.target));
        dagre.layout(graph);
        active.forEach((document) => { const point = graph.node(document.path); nodes.push(makeNode(document, point.x - 112, point.y - 55, false)); });
      } else {
        const clusters = [...new Set(active.map((document) => document.folder))];
        const points: Point[] = active.map((document, index) => ({ id: document.path, cluster: clusters.indexOf(document.folder), x: Math.cos(index * 2.4) * 280, y: Math.sin(index * 2.4) * 280 }));
        const simulation = forceSimulation(points)
          .force('links', forceLink<Point, { source: string; target: string }>(relations.map((edge) => ({ source: edge.source, target: edge.target }))).id((point) => point.id).distance(260).strength(0.16))
          .force('charge', forceManyBody().strength(-650)).force('collision', forceCollide(125))
          .force('x', forceX<Point>((point) => (point.cluster % 3) * 300).strength(0.045))
          .force('y', forceY<Point>((point) => Math.floor(point.cluster / 3) * 260).strength(0.045)).stop();
        simulation.tick(220);
        active.forEach((document, index) => nodes.push(makeNode(document, points[index]?.x ?? 0, points[index]?.y ?? 0, true)));
      }
      if (isolated.length) {
        const x = nodes.length ? Math.max(...nodes.map((node) => node.position.x)) + 330 : 0;
        const y = nodes.length ? Math.min(...nodes.map((node) => node.position.y)) : 0;
        nodes.push(header('group:unlinked-files', 'No links', isolated.length, x, y, 274, 64 + isolated.length * 86, '#8a98a5'));
        isolated.forEach((document, index) => nodes.push({ ...makeNode(document, 24, 54 + index * 86, true), parentId: 'group:unlinked-files', extent: 'parent' }));
      }
    }
    // Preserve directed data; combine reciprocal display strokes by kind.
    const pairs = new Map<string, { source: string; target: string; kind: string; forward: boolean; reverse: boolean; count: number }>();
    for (const edge of relations) {
      const [source, target] = [edge.source, edge.target].sort() as [string, string];
      const key = JSON.stringify([edge.kind, source, target]);
      const pair = pairs.get(key) ?? { source, target, kind: edge.kind, forward: false, reverse: false, count: 0 };
      pair.forward ||= edge.source === source; pair.reverse ||= edge.source === target; pair.count++;
      pairs.set(key, pair);
    }
    return { nodes, pairs: [...pairs.entries()], relations };

}

import { Badge, Heading, HStack, Text } from '@chakra-ui/react';
import { Picker } from '../Picker';
import { Properties } from './Properties';
import { groupDocuments, labelOf, type Document } from './model';

export function GenericBoard({ documents, properties, grouping, selected, onGroup, onOpen }: { documents: Document[]; properties: string[]; grouping: string; selected: string; onGroup: (group: string) => void; onOpen: (path: string) => void }) {
  const groups = groupDocuments(documents, grouping);
  return <div className="generic-board"><div className="board-controls"><Picker label="Group by" items={[{ value: 'folder', label: 'Physical folder' }, ...properties.map((key) => ({ value: `property:${key}`, label: `${labelOf(key)} property` }))]} value={[grouping]} onChange={(values) => onGroup(values[0] ?? 'folder')} /><Text fontSize="xs" color="fg.muted">Values from the files · read-only</Text></div>
    {!groups.length && <p className="workspace-empty">No matching Markdown files.</p>}
    <div className="generic-columns" aria-label="Document board">{groups.map((group) => <section className="generic-column" key={group.id} aria-label={`${group.label} group`} data-group={group.id}><HStack mb="3"><Heading size="sm" overflowWrap="anywhere">{group.label}</Heading><Badge ms="auto" size="xs" variant="outline">{group.documents.length}</Badge></HStack>
      {group.documents.map((document) => <button type="button" className={`generic-card ${selected === document.path ? 'is-selected' : ''}`} key={document.path} onClick={() => onOpen(document.path)} aria-label={`Read ${document.path}`}><strong>{document.title}</strong><small title={document.path}>{document.path}</small><Properties document={document} compact /></button>)}
    </section>)}</div></div>;
}

import { Badge, Text } from '@chakra-ui/react';
import type { Document } from './model';

export function Properties({ document, compact = false }: { document: Pick<Document, 'properties'>; compact?: boolean }) {
  const entries = compact ? document.properties.slice(0, 3) : document.properties;
  return <div className={compact ? 'property-badges' : 'property-grid'}>
    {entries.map((entry, index) => compact
      ? <Badge key={index} size="xs" variant="subtle" title={`${entry.label}: ${entry.value}`} maxW="full" overflow="hidden">{entry.label}: {entry.valid ? entry.value || '(empty)' : 'Invalid metadata'}</Badge>
      : <div key={index}><Text fontSize="xs" color="fg.muted">{entry.label} <span className="property-source">{entry.source}</span></Text><Text fontSize="sm" overflowWrap="anywhere">{entry.value || '(empty)'}</Text><details><summary>Original property</summary><pre>{entry.raw}</pre></details></div>)}
  </div>;
}

import { Badge, Box, Text } from '@chakra-ui/react';
import type { Document } from './model';

export function Properties({ document, compact = false }: { document: Pick<Document, 'properties'>; compact?: boolean }) {
  const entries = compact ? document.properties.slice(0, 3) : document.properties;
  return <Box display={compact ? 'flex' : 'grid'} gap={compact ? '1' : '3'} flexWrap="wrap" mt={compact ? '2' : '3'} mb={compact ? '0' : '5'} py={compact ? '0' : '3.5'} borderYWidth={compact ? '0' : '1px'} gridTemplateColumns={compact ? undefined : 'repeat(auto-fit,minmax(150px,1fr))'} css={{ '& details': { color: 'fg.muted', fontSize: '10px' }, '& pre': { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }}>
    {entries.map((entry, index) => compact
      ? <Badge key={index} size="xs" variant="subtle" title={`${entry.label}: ${entry.value}`} maxW="full" overflow="hidden">{entry.label}: {entry.valid ? entry.value || '(empty)' : 'Invalid metadata'}</Badge>
      : <div key={index}><Text fontSize="xs" color="fg.muted">{entry.label} <span className="property-source">{entry.source}</span></Text><Text fontSize="sm" overflowWrap="anywhere">{entry.value || '(empty)'}</Text><details><summary>Original property</summary><pre>{entry.raw}</pre></details></div>)}
  </Box>;
}

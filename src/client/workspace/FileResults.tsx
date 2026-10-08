import { LuChevronRight, LuFileText } from 'react-icons/lu';
import { Properties } from './Properties';
import type { Document } from './model';
import { Box, Button, Text } from '@chakra-ui/react';

export function FileResults({ documents, selected, onOpen }: { documents: Document[]; selected: string; onOpen: (path: string) => void }) {
  if (!documents.length) return <Text p="10" color="fg.muted" textAlign="center">No matching Markdown files. Clear the filters to browse the collection.</Text>;
  return <Box aria-label="Markdown files">{documents.map((document) => <Button type="button" variant="plain" key={document.path} className="file-row" disabled={document.status.reason === 'Creating…'} aria-label={`Read ${document.path}`} aria-pressed={document.path === selected} onClick={() => onOpen(document.path)}
    display="flex" gap="2.5" w="full" h="auto" rounded="none" borderBottomWidth="1px" p="4" alignItems="start" textAlign="start" whiteSpace="normal" color="fg" bg={document.path === selected ? 'orange.subtle' : 'bg.panel'} boxShadow={document.path === selected ? 'inset 3px 0 var(--chakra-colors-orange-500)' : undefined} _hover={{ bg: 'bg.subtle' }}>
    <Box color="fg.muted" mt="1" flexShrink="0"><LuFileText /></Box><Box flex="1" minW="0"><Text as="strong" display="block" fontFamily="issueTitle" fontSize="md" fontWeight="600" lineHeight="1.3">{document.title}</Text><Text fontSize="10px" color="fg.muted" mt="1" truncate title={document.path}>{document.path}</Text><Properties document={document} compact />{document.diagnostics.length > 0 && <Text fontSize="10px" color="fg.muted" mt="1">{document.content === null ? 'Preview unavailable' : `${document.diagnostics.length} notice${document.diagnostics.length === 1 ? '' : 's'}`}</Text>}</Box><Box color="fg.muted" mt="1" flexShrink="0"><LuChevronRight /></Box>
  </Button>)}</Box>;
}

import { Badge, Box, Button, Heading, HStack, Text } from '@chakra-ui/react';
import { Picker } from '../Picker';
import { Properties } from './Properties';
import { groupDocuments, labelOf, type Document } from './model';

export function GenericBoard({ documents, properties, grouping, selected, onGroup, onOpen }: { documents: Document[]; properties: string[]; grouping: string; selected: string; onGroup: (group: string) => void; onOpen: (path: string) => void }) {
  const groups = groupDocuments(documents, grouping);
  const propertyGrouping = grouping.startsWith('property:');
  return <Box display="flex" flexDirection="column" h="full" minH="250px" p="5">
    {!groups.length && <Text p="10" color="fg.muted" textAlign="center">No matching Markdown files.</Text>}
    <Box display="flex" flex="1" gap="4" overflow="auto" minH="0" aria-label="Document board">{groups.map((group) => <Box as="section" className="generic-column" key={group.id} aria-label={`${group.label}${propertyGrouping && group.id === 'missing' ? ' (missing property)' : ''} group`} data-group={group.id} flex="1 0 240px" maxW="340px" overflowY="auto"><HStack mb="3" flexWrap="wrap"><Heading size="sm" overflowWrap="anywhere">{group.label}</Heading>{propertyGrouping && group.id === 'missing' && <Badge size="xs" variant="subtle">Missing property</Badge>}<Badge ms="auto" size="xs" variant="outline">{group.documents.length}</Badge></HStack>
      {group.documents.map((document) => <Button type="button" variant="plain" className="generic-card" key={document.path} onClick={() => onOpen(document.path)} aria-label={`Read ${document.path}`} display="block" w="full" h="auto" textAlign="start" whiteSpace="normal" borderWidth="1px" rounded="md" p="3.5" mb="2" color="fg" bg={selected === document.path ? 'orange.subtle' : 'bg.panel'} _hover={{ bg: 'bg.subtle' }}>
        <Text as="strong" display="block" fontFamily="issueTitle" fontSize="md" fontWeight="600" lineHeight="1.3">{document.title}</Text><Text fontSize="10px" color="fg.muted" mt="1" truncate title={document.path}>{document.path}</Text><Properties document={document} compact />
      </Button>)}
    </Box>)}</Box></Box>;
}

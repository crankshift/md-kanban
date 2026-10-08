import { Suspense, useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, Heading, HStack, IconButton, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuBookOpen, LuNetwork, LuX } from 'react-icons/lu';
import { openedDocumentSchema, type DocumentRelation } from '../../server/document-types.js';
import { diskKey, useDiskQuery } from '../ClientState';
import { resolveLink } from './links';
import { LazySafeMarkdown } from '../LazySafeMarkdown';
import { Properties } from './Properties';
import type { Document } from './model';

export function WorkspaceReader({ path, fragment, documents, edges, canUseTools, onOpen, onClose, onBack, onNeighborhood, onTools, onFragment }: {
  path: string; fragment: string | null; documents: Document[]; edges: DocumentRelation[]; canUseTools: boolean;
  onOpen: (path: string, fragment?: string | null) => void; onClose: () => void; onBack: () => void; onNeighborhood: () => void; onTools: () => void; onFragment: (fragment: string) => void;
}) {
  const query = useDiskQuery([...diskKey, 'document', path], `/api/document?${new URLSearchParams({ path })}`, openedDocumentSchema, undefined, !!path);
  const [notice, setNotice] = useState('');
  const panel = useRef<HTMLElement>(null);
  const current = useRef(path);
  current.current = path;
  useEffect(() => { setNotice(''); panel.current?.scrollTo?.(0, 0); }, [path]);
  if (!path) return <Box display="flex" flexDirection="column" gap="3.5" alignItems="center" justifyContent="center" minH="full" p="9" textAlign="center" color="fg.muted"><LuBookOpen size={34} /><Heading size="md">Choose a file to read</Heading><Text fontSize="sm" maxW="280px">Markdown files need no status, number, or links to belong here.</Text></Box>;
  const document = query.data;
  const indexed = documents.find((document) => document.path === path);
  const outgoing = edges.filter((edge) => edge.source === path && edge.kind === 'link');
  const incoming = edges.filter((edge) => edge.target === path && edge.kind === 'link');
  async function follow(href: string) {
    const from = path;
    const target = await resolveLink(from, href);
    if (current.current !== from) return;
    if (target.status === 'available') onOpen(target.path, target.fragment);
    else setNotice(`Unavailable link “${href}”: ${target.reason}`);
  }
  function relations(label: string, entries: DocumentRelation[], reverse = false) {
    return <Box as="section" display="flex" flexDirection="column" alignItems="stretch" aria-label={label}><Heading size="xs" mb="2">{label} ({entries.length})</Heading>
      {entries.length ? entries.map((edge, index) => { const target = reverse ? edge.source : edge.target;
        return <Button key={index} size="xs" variant="ghost" h="auto" py="1.5" justifyContent="start" whiteSpace="normal" textAlign="start" title={target} onClick={() => onOpen(target)}>{documents.find((document) => document.path === target)?.title ?? target}{edge.kind === 'dependency' ? ` · ${edge.property} dependency` : ''}</Button>;
      }) : <Text fontSize="xs" color="fg.muted">No {label.toLowerCase()}.</Text>}
    </Box>;
  }
  return <Box as="section" p={{ base: '4.5', md: '6' }} h="full" overflow="auto" aria-label="Document reader" ref={panel} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <HStack gap="3" align="start" justify="space-between"><Box><Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">{path}</Text><Heading size="lg" mt="2">{document?.title ?? indexed?.title ?? path.split('/').at(-1)}</Heading></Box><IconButton size="xs" variant="ghost" aria-label="Close document reader" onClick={onClose}><LuX /></IconButton></HStack>
    <HStack my="3" flexWrap="wrap"><Badge size="xs" variant="outline">Read-only</Badge><Button size="xs" variant="subtle" disabled={!indexed} onClick={onNeighborhood}><LuNetwork />Show neighborhood</Button><Button size="xs" variant="ghost" onClick={onBack}><LuArrowLeft />Back</Button>{canUseTools && <Button size="xs" onClick={onTools}>Issue tools</Button>}<Button size="xs" variant="ghost" onClick={() => void query.refetch()}>Reload document</Button></HStack>
    {!indexed && <Text fontSize="xs" color="fg.muted">This file is outside the automatic collection. Reading it does not add a map node.</Text>}
    {document && document.properties.length > 0 && <Properties document={document} />}
    {[...new Set([...(indexed?.diagnostics ?? []), ...(document?.diagnostics ?? [])])].map((diagnostic) => <Text role="status" color="fg.warning" fontSize="xs" my="2" key={diagnostic}>{diagnostic}</Text>)}
    {notice && <Text role="alert" fontSize="sm">{notice}</Text>}
    {query.isError ? <Text role="alert">Unavailable: {query.error.message}</Text> : !document ? <Text role="status">Reading Markdown…</Text> : <Box maxW="850px"><Box as="section" fontSize="sm" lineHeight="1.75" overflowWrap="anywhere" aria-label="Document Markdown"><Suspense fallback={<Text role="status">Loading document…</Text>}><LazySafeMarkdown fragment={fragment} onFragment={onFragment} onMissingFragment={(fragment) => setNotice(`The section “${fragment}” was not found in this document.`)} onLocalLink={(href) => { void follow(href); }}>{document.body}</LazySafeMarkdown></Suspense></Box>
      <Box display="grid" gridTemplateColumns="repeat(auto-fit,minmax(180px,1fr))" gap="5" pt="6" mt="6" borderTopWidth="1px">{relations('Links from this file', outgoing)}{relations('Backlinks', incoming, true)}{relations('Dependencies from this file', edges.filter((edge) => edge.source === path && edge.kind === 'dependency'))}{relations('Incoming dependencies', edges.filter((edge) => edge.target === path && edge.kind === 'dependency'), true)}</Box>
    </Box>}
  </Box>;
}

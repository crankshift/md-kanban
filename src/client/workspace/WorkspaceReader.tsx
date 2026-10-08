import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Heading, HStack, IconButton, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuBookOpen, LuNetwork, LuX } from 'react-icons/lu';
import { openedDocumentSchema, type DocumentRelation } from '../../server/document-types.js';
import { diskKey, useDiskQuery } from '../ClientState';
import { resolveLink } from '../Documents';
import { SafeMarkdown } from '../SafeMarkdown';
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
  if (!path) return <div className="reader-empty"><LuBookOpen size={34} /><Heading size="md">Choose a file to read</Heading><Text color="fg.muted" fontSize="sm">Markdown files need no status, number, or links to belong here.</Text></div>;
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
    return <section className="reader-relations" aria-label={label}><Heading size="xs" mb="2">{label} ({entries.length})</Heading>
      {entries.length ? entries.map((edge, index) => { const target = reverse ? edge.source : edge.target;
        return <Button key={index} size="xs" variant="ghost" h="auto" py="1.5" justifyContent="start" whiteSpace="normal" textAlign="start" title={target} onClick={() => onOpen(target)}>{documents.find((document) => document.path === target)?.title ?? target}{edge.kind === 'dependency' ? ` · ${edge.property} dependency` : ''}</Button>;
      }) : <Text fontSize="xs" color="fg.muted">No {label.toLowerCase()}.</Text>}
    </section>;
  }
  return <section className="workspace-reader" aria-label="Document reader" ref={panel} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <div className="reader-heading"><div><Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">{path}</Text><Heading size="lg" mt="2">{document?.title ?? indexed?.title ?? path.split('/').at(-1)}</Heading></div><IconButton size="xs" variant="ghost" aria-label="Close document reader" onClick={onClose}><LuX /></IconButton></div>
    <HStack my="3" flexWrap="wrap"><Badge size="xs" variant="outline">Read-only</Badge><Button size="xs" variant="subtle" disabled={!indexed} onClick={onNeighborhood}><LuNetwork />Show neighborhood</Button><Button size="xs" variant="ghost" onClick={onBack}><LuArrowLeft />Back</Button>{canUseTools && <Button size="xs" onClick={onTools}>Issue tools</Button>}<Button size="xs" variant="ghost" onClick={() => void query.refetch()}>Reload document</Button></HStack>
    {!indexed && <Text fontSize="xs" color="fg.muted">This file is outside the automatic collection. Reading it does not add a map node.</Text>}
    {document && document.properties.length > 0 && <Properties document={document} />}
    {[...new Set([...(indexed?.diagnostics ?? []), ...(document?.diagnostics ?? [])])].map((diagnostic) => <Text role="status" color="fg.warning" fontSize="xs" my="2" key={diagnostic}>{diagnostic}</Text>)}
    {notice && <Text role="alert" fontSize="sm">{notice}</Text>}
    {query.isError ? <Text role="alert">Unavailable: {query.error.message}</Text> : !document ? <Text role="status">Reading Markdown…</Text> : <div className="reader-body"><section className="reader-markdown" aria-label="Document Markdown"><SafeMarkdown fragment={fragment} onFragment={onFragment} onMissingFragment={(fragment) => setNotice(`The section “${fragment}” was not found in this document.`)} onLocalLink={(href) => { void follow(href); }}>{document.body}</SafeMarkdown></section>
      <div className="reader-link-sections">{relations('Links from this file', outgoing)}{relations('Backlinks', incoming, true)}{relations('Dependencies from this file', edges.filter((edge) => edge.source === path && edge.kind === 'dependency'))}{relations('Incoming dependencies', edges.filter((edge) => edge.target === path && edge.kind === 'dependency'), true)}</div>
    </div>}
  </section>;
}

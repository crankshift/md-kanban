import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { Badge, Box, Button, Heading, HStack, Input, Text } from '@chakra-ui/react';
import { LuBookOpen, LuLayoutList, LuNetwork, LuRefreshCw, LuSearch, LuTable2 } from 'react-icons/lu';
import { documentListSchema } from '../../server/document-types.js';
import type { BoardData } from '../../server/board.js';
import { diskKey, useDiskQuery } from '../ClientState';
import { ColorModeButton } from '../components/ui/color-mode';
import { Picker } from '../Picker';
import { FolderTree } from './FolderTree';
import { FileResults } from './FileResults';
import { GenericBoard } from './GenericBoard';
import { WorkspaceReader } from './WorkspaceReader';
import { MapView } from './MapView';
import { folderPaths, labelOf, propertyValue, mapSettings } from './model';
import './workspace.css';

export function Workspace({ folder, issues, canWrite, sessionProblem }: { folder?: string | undefined; issues?: BoardData | undefined; canWrite: boolean; sessionProblem: boolean }) {
  const query = useDiskQuery([...diskKey, 'documents'], '/api/documents', documentListSchema);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const set = useCallback((values: Record<string, string | null>, replace = false) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) if (value !== null && value !== '') next.set(key, value); else next.delete(key);
    return next;
  }, { replace }), [setParams]);
  const open = useCallback((file: string, anchor: string | null = null) => set({ file, anchor, issue: null, document: null, create: null }), [set]);
  const selected = params.get('file') ?? params.get('document') ?? params.get('issue') ?? '';
  const view = ['files', 'board', 'map'].includes(params.get('view') ?? '') ? params.get('view')! : 'files';
  const scope = params.get('folder') ?? '';
  const search = params.get('q') ?? '';
  const property = params.get('property') ?? '';
  const value = params.get('value') ?? '';
  const settings = mapSettings(params);
  const { mode, relation, dependency } = settings;
  let collapsed: string[] = [];
  try { const parsed: unknown = JSON.parse(params.get('collapsed') ?? '[]'); if (Array.isArray(parsed)) collapsed = parsed.filter((value): value is string => typeof value === 'string'); } catch { /* Malformed optional URL state uses the expanded tree. */ }
  const documents = query.data?.documents ?? [];
  const folders = useMemo(() => folderPaths(documents), [documents]);
  const properties = useMemo(() => [...new Set(documents.flatMap((document) => document.properties.map((entry) => entry.key)))].sort(), [documents]);
  const grouping = params.get('group') ?? (properties.includes('status') ? 'property:status' : 'folder');
  const relationships = useMemo(() => (query.data?.edges ?? []).filter((edge) => edge.kind === 'link' || edge.property === dependency), [query.data?.edges, dependency]);
  const edges = useMemo(() => relationships.filter((edge) => relation === 'all' || edge.kind === relation), [relationships, relation]);
  const filtered = useMemo(() => documents.filter((document) => (!scope || document.path.startsWith(scope + '/'))
    && (!search.trim() || `${document.path}\n${document.title}\n${document.content ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    && (!property || !value || propertyValue(document, property).id === value)), [documents, scope, search, property, value]);
  const values = [...new Map(documents.map((document) => { const value = propertyValue(document, property); return [value.id, value]; })).values()].sort((a, b) => a.label.localeCompare(b.label));
  const neighborhood = useMemo(() => {
    const paths = new Set([selected]);
    for (const edge of edges) if (edge.source === selected) paths.add(edge.target); else if (edge.target === selected) paths.add(edge.source);
    return documents.filter((document) => paths.has(document.path));
  }, [documents, edges, selected]);
  const [live, setLive] = useState('connecting');
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/events');
    const sync = () => { setLive('live'); void client.invalidateQueries({ queryKey: diskKey }); };
    source.addEventListener('ready', sync);
    source.addEventListener('change', sync);
    source.addEventListener('error', () => setLive('offline'));
    return () => source.close();
  }, [client]);
  return <Box className="markdown-workspace" h="100dvh" overflow="hidden" bg="bg.subtle">
    <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '190px minmax(0,1fr)', xl: '230px minmax(0,1fr)' }} h="full">
      <Box as="aside" display={{ base: 'none', md: 'flex' }} flexDirection="column" borderRightWidth="1px" bg="bg.panel" minH="0">
        <Box p="4" flexShrink="0"><HStack gap="2"><Box color="orange.500"><LuBookOpen size={23} /></Box><Heading size="md">mdboard</Heading></HStack><Text color="fg.muted" fontSize="xs" mt="2" title={folder}>{folder?.split('/').at(-1) ?? 'Selected folder'} / Markdown workspace</Text></Box>
        <FolderTree documents={documents} folders={folders} scope={scope} collapsed={collapsed} onCollapse={(folders) => set({ collapsed: folders.length ? JSON.stringify(folders) : null })} onScope={(folder) => set({ folder })} />
        <Box mt="auto" borderTopWidth="1px"><HStack justify="space-between" px="3" py="3"><Text color="fg.muted" fontSize="xs">{documents.length} files · {query.isError || sessionProblem ? 'outdated' : live}</Text><ColorModeButton size="xs" /></HStack></Box>
      </Box>
      <Box as="main" display="flex" flexDirection="column" minW="0" minH="0">
        <Box display="flex" flexDirection={{ base: 'column', md: 'row' }} minH="20" justifyContent="space-between" alignItems={{ base: 'start', md: 'center' }} gap="3" p={{ base: '3', md: '5' }} borderBottomWidth="1px" bg="bg.panel" flexShrink="0">
          <Box><Heading size="lg">{scope || 'All files'}</Heading><Text fontSize="xs" color="fg.muted" mt="1">{filtered.length} Markdown files{scope ? ' · including subfolders' : ''}</Text></Box>
          <HStack gap="1" flexWrap="wrap" aria-label="Workspace views">
            {([['files', 'Files', <LuLayoutList />], ['board', 'Board', <LuTable2 />], ['map', 'Map', <LuNetwork />]] as const).map(([key, label, icon]) => <Button size="sm" key={key} variant={view === key ? 'subtle' : 'ghost'} colorPalette={view === key ? 'orange' : 'gray'} aria-pressed={view === key} onClick={() => set({ view: key })}>{icon}{label}</Button>)}
            {canWrite && <Button size="sm" variant="outline" onClick={() => set({ create: 'true', issue: null })}>New issue</Button>}
            <Box display={{ base: 'block', md: 'none' }}><ColorModeButton size="xs" /></Box>
          </HStack>
        </Box>
        <Box display="flex" alignItems="end" flexWrap="wrap" gap="2" px={{ base: '3', md: '5' }} py="3" borderBottomWidth="1px" bg="bg.panel" css={{ '& label': { fontSize: '11px', color: 'fg.muted' } }}>
          <Box display="flex" alignItems="center" position="relative" flex="1 1 210px" minW="150px" maxW="380px"><Box position="absolute" left="2.5" zIndex="1" color="fg.muted"><LuSearch /></Box><Input type="search" size="sm" ps="8" aria-label="Search Markdown files" placeholder="Search files and text…" value={search} onChange={(event) => set({ q: event.target.value }, true)} /></Box>
          <Box display={{ base: 'block', md: 'none' }} w="170px"><Picker label="Folder scope" items={[{ value: '', label: 'All folders' }, ...folders.map((folder) => ({ value: folder, label: folder }))]} value={[scope]} onChange={(values) => set({ folder: values[0] ?? null })} /></Box>
          <Box w="170px"><Picker label="Property" items={[{ value: '', label: 'Any property' }, ...properties.map((key) => ({ value: key, label: labelOf(key) }))]} value={[property]} onChange={(values) => set({ property: values[0] ?? null, value: null })} /></Box>
          {property && <Box w="170px"><Picker label="Value" items={[{ value: '', label: 'Any value' }, ...values.map((entry) => ({ value: entry.id, label: entry.choiceLabel }))]} value={[value]} onChange={(values) => set({ value: values[0] ?? null })} /></Box>}
          {!!(search || scope || property) && <Button size="sm" variant="ghost" onClick={() => set({ q: null, folder: null, property: null, value: null })}>Clear</Button>}
          <Button size="sm" variant="ghost" aria-label="Reload Markdown files" onClick={() => void client.invalidateQueries({ queryKey: diskKey })}><LuRefreshCw /></Button>
        </Box>
        {(query.isError || sessionProblem) && <Text px="4" py="2" bg="bg.panel" role="alert">Cannot refresh the workspace: outdated data is shown. Your open draft is kept. Check access and reload.</Text>}
        {query.data?.warnings.map((warning) => <Text px="4" py="2" bg="bg.panel" role="alert" key={warning}>{warning}</Text>)}
        <Box display="grid" flex="1" minH="0" gridTemplateColumns={{ base: 'minmax(0,1fr)', md: view === 'files' ? 'minmax(220px,38%) minmax(0,1fr)' : selected ? 'minmax(300px,1fr) minmax(340px,42%)' : 'minmax(0,1fr)' }} gridTemplateRows={{ base: view !== 'files' && selected ? 'minmax(260px,50%) minmax(0,1fr)' : 'minmax(0,1fr)', md: 'minmax(0,1fr)' }}>
          <Box display={{ base: view === 'files' && selected ? 'none' : 'block', md: 'block' }} minW="0" minH="0" overflow="auto">
            {!query.data ? <Text p="10" color="fg.muted" textAlign="center" role="status">Reading Markdown files…</Text> : view === 'files' ? <FileResults documents={filtered} selected={selected} onOpen={open} /> : view === 'board' ? <GenericBoard documents={filtered} properties={properties} grouping={grouping} selected={selected} onGroup={(group) => set({ group })} onOpen={open} /> : <MapView documents={mode === 'local' && selected ? neighborhood : filtered} edges={edges} properties={properties} selected={selected} settings={settings} onSet={set} onOpen={open} />}
          </Box>
          <Box display={{ base: selected ? 'block' : 'none', md: view === 'files' || selected ? 'block' : 'none' }} bg="bg.panel" borderLeftWidth={{ base: '0', md: '1px' }} overflow="auto" minW="0" minH="0">
            <WorkspaceReader path={selected} fragment={params.get('anchor') ?? params.get('fragment')} documents={documents} edges={relationships} canUseTools={canWrite && !!issues?.issues.some((issue) => issue.path === selected)} onOpen={open} onClose={() => set({ file: null, anchor: null, issue: null, document: null, fragment: null })} onBack={() => { void navigate(-1); }} onNeighborhood={() => set({ view: 'map', map: 'local' })} onTools={() => set({ issue: selected })} onFragment={(anchor) => set({ anchor })} />
          </Box>
        </Box>
      </Box>
    </Box>
  </Box>;
}

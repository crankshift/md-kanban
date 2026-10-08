import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, Button, Input, Text, Textarea } from '@chakra-ui/react';
import { Overlay } from '../Overlay';
import { Picker } from '../Picker';
import type { Document } from './model';
import { useDocumentWrite } from './useDocumentWrite';
import { useDraftGuard } from './DocumentTools';

export function filenameFor(documents: Document[], folder: string, title: string) {
  const slug = title.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'new-issue';
  const names = documents.filter(d => (d.folder === '.' ? '' : d.folder) === folder).map(d => d.name);
  const numbered = names.map(name => name.match(/^(\d+)([-_. ])[^/]+\.(?:md|markdown)$/i));
  const clear = numbered.length > 0 && numbered.every(match => match && match[2] === numbered[0]?.[2]);
  return (clear ? String(Math.max(...numbered.map(m => Number(m![1]))) + 1).padStart(Math.max(...numbered.map(m => m![1]!.length)), '0') + numbered[0]![2] : '') + slug + '.md';
}
export default function DocumentCreator({ scope, status, documents, folders, hidden, sessionToken, onClose, onCreated, onFolder, recovery }: {
  scope: string; status: string; documents: Document[]; folders: string[]; hidden: string[]; sessionToken?: string | undefined; onClose: () => void; onCreated: (path: string) => void; onFolder: (parent: string) => void; recovery?: string | undefined;
}) {
  const client = useQueryClient();
  const recovered = client.getMutationCache().getAll().find(m => String(m.mutationId) === recovery)?.state.variables as { body: { folder: string; title: string; filename: string; status: string; body: string } } | undefined;
  const [draft, setDraft] = useState(recovered?.body ?? { folder: scope, title: '', filename: '', status, body: '' });
  const previousScope = useRef(scope);
  useEffect(() => { if (scope !== previousScope.current) { setDraft(previous => ({ ...previous, folder: scope })); previousScope.current = scope; } }, [scope]);
  const touched = useRef(!!recovered), initial = useRef(draft);
  const { mutation, busy } = useDocumentWrite(sessionToken);
  const dirty = !!recovered || JSON.stringify(draft) !== JSON.stringify(initial.current);
  const allow = useDraftGuard(dirty || !!recovered, mutation.isPending);
  const suggestions = useMemo(() => [...new Set(documents.filter(d => !draft.folder || d.path.startsWith(draft.folder + '/')).filter(d => d.status.key.startsWith('value:')).map(d => d.status.label))], [documents, draft.folder]);
  const filename = touched.current ? draft.filename : filenameFor(documents, draft.folder, draft.title);
  return <Overlay open title="New issue" onClose={() => { if (!mutation.isPending && (!dirty || window.confirm('Discard the unsaved draft?'))) { allow(); onClose(); } }}><Box as="form" onSubmit={event => { event.preventDefault(); if (busy) return; mutation.mutate({ endpoint: '/api/documents/create', body: { ...draft, filename } }, { onSuccess: value => { allow(); if (recovery) client.getMutationCache().getAll().filter(m => String(m.mutationId) === recovery).forEach(m => client.getMutationCache().remove(m)); onCreated(value.path); } }); }} display="grid" gap="3">
    <fieldset disabled={busy}><Picker label="Target folder" items={[{ value: '', label: 'Launch folder' }, ...folders.map(folder => ({ value: folder, label: folder }))]} value={[draft.folder]} onChange={values => setDraft(previous => ({ ...previous, folder: values[0] ?? '' }))} /><Button size="xs" variant="ghost" onClick={() => onFolder(draft.folder)}>New folder</Button>
      {hidden.some(folder => draft.folder === folder || draft.folder.startsWith(folder + '/')) && <Text fontSize="xs">This folder is hidden from the collection; creation does not reveal it.</Text>}
      <label>Title<Input required aria-label="Issue title" value={draft.title} onChange={event => setDraft(previous => ({ ...previous, title: event.target.value }))} /></label>
      <label>Filename<Input required aria-label="Issue filename" value={filename} onChange={event => { touched.current = true; setDraft(previous => ({ ...previous, filename: event.target.value })); }} /></label>
      <label>Status (optional)<Input aria-label="Issue status" list="target-statuses" value={draft.status} onChange={event => setDraft(previous => ({ ...previous, status: event.target.value }))} placeholder="No status" /><datalist id="target-statuses">{suggestions.map(label => <option key={label} value={label} />)}</datalist></label>
      <label>Body (optional)<Textarea aria-label="Issue body" value={draft.body} onChange={event => setDraft(previous => ({ ...previous, body: event.target.value }))} /></label>
      {mutation.isError && <Text role="alert">{mutation.error.message} Your draft is kept. Review Files before retrying a possible lost response; existing files are never overwritten.</Text>}
      <Button type="submit" mt="3" loading={mutation.isPending}>Create issue</Button>
    </fieldset>
  </Box></Overlay>;
}
export function FolderCreator({ parent, folders, sessionToken, onClose, onCreated, nested = false }: { parent: string; folders: string[]; sessionToken?: string | undefined; onClose: () => void; onCreated: (path: string) => void; nested?: boolean }) {
  const [target, setTarget] = useState(parent), [name, setName] = useState('');
  const { mutation, busy } = useDocumentWrite(sessionToken);
  const allowClose = useRef(false);
  // The parent issue form already guards navigation for a nested folder dialog.
  return <Overlay open title="New folder" onClose={() => { if (!mutation.isPending && (!name || window.confirm('Discard the folder name?'))) { allowClose.current = true; onClose(); } }}><Box as="form" onSubmit={event => { event.preventDefault(); if (!busy) mutation.mutate({ endpoint: '/api/folders', body: { parent: target, name } }, { onSuccess: value => { allowClose.current = true; onCreated(value.path); } }); }}><fieldset disabled={busy}>
    <Picker label="Parent folder" items={[{ value: '', label: 'Launch folder' }, ...folders.map(folder => ({ value: folder, label: folder }))]} value={[target]} onChange={values => setTarget(values[0] ?? '')} /><label>Folder name<Input required aria-label="Folder name" value={name} onChange={event => setName(event.target.value)} /></label><Text fontSize="xs" color="fg.muted" my="2">Creates a real directory immediately. It remains if New issue is cancelled.</Text>{mutation.isError && <Text role="alert">{mutation.error.message}</Text>}<Button type="submit" loading={mutation.isPending}>Create folder</Button>
  </fieldset>{!nested && <FolderDraftGuard dirty={!!name} pending={mutation.isPending} allowClose={allowClose} />}</Box></Overlay>;
}

function FolderDraftGuard({ dirty, pending, allowClose }: { dirty: boolean; pending: boolean; allowClose: { current: boolean } }) {
  useDraftGuard(dirty, pending, ['newFolder'], allowClose);
  return null;
}

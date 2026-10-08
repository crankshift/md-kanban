import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBlocker, useBeforeUnload } from 'react-router';
import { Box, Button, Input, Text, Textarea } from '@chakra-ui/react';
import { openedDocumentSchema, type OpenedDocument } from '../../server/document-types';
import { diskKey, useDiskQuery } from '../ClientState';
import { Overlay } from '../Overlay';
import { MarkdownEditor } from '../MarkdownEditor';
import { useDocumentWrite } from './useDocumentWrite';

export function useDraftGuard(dirty: boolean, pending: boolean, keys = ['file', 'tool', 'create'], allowRef?: { current: boolean }) {
  const localAllowed = useRef(false);
  const allowed = allowRef ?? localAllowed;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => { const from = new URLSearchParams(currentLocation.search), to = new URLSearchParams(nextLocation.search); return !allowed.current && (dirty || pending) && (currentLocation.pathname !== nextLocation.pathname || keys.some(key => from.get(key) !== to.get(key))); });
  useEffect(() => { if (blocker.state === 'blocked') { if (!pending && window.confirm('Discard the unsaved draft?')) blocker.proceed(); else blocker.reset(); } }, [blocker, pending]);
  useBeforeUnload(useCallback(event => { if (!allowed.current && (dirty || pending)) { event.preventDefault(); event.returnValue = ''; } }, [dirty, pending]));
  return () => { allowed.current = true; };
}
export default function DocumentTools({ path, mode, sessionToken, onClose, recovery }: { path: string; mode: string; sessionToken?: string | undefined; onClose: () => void; recovery?: string | undefined }) {
  const query = useDiskQuery([...diskKey, 'document', path], '/api/document?' + new URLSearchParams({ path }), openedDocumentSchema);
  const client = useQueryClient();
  const recovered = client.getMutationCache().getAll().find(m => String(m.mutationId) === recovery)?.state.variables as { body: Record<string, unknown>; document?: OpenedDocument } | undefined;
  const [base, setBase] = useState<OpenedDocument | null>(null), [draft, setDraft] = useState(''), [label, setLabel] = useState('');
  const { mutation, busy } = useDocumentWrite(sessionToken);
  useEffect(() => { if (!base && query.data) { setBase(recovered?.document ?? query.data); setDraft(recovered ? String(recovered.body.content ?? recovered.body.comment ?? '') : mode === 'edit' ? query.data.content : ''); setLabel(query.data.status.key.startsWith('value:') ? query.data.status.label : ''); } }, [base, query.data, mode]);
  const dirty = !!base && (mode === 'edit' ? draft !== base.content : mode === 'comment' ? !!draft : label !== (base.status.key.startsWith('value:') ? base.status.label : ''));
  const allow = useDraftGuard(dirty, mutation.isPending);
  const changed = base && query.data?.revision !== base.revision;
  const title = mode === 'edit' ? 'Edit document' : mode === 'comment' ? 'Add comment' : 'Change status';
  function close() { if (!mutation.isPending && (!dirty || window.confirm('Discard the unsaved draft?'))) { allow(); onClose(); } }
  return <Overlay open title={title} onClose={close}><Box as="form" onSubmit={event => {
    event.preventDefault(); if (!base || !base.revision || busy || changed) return;
    const endpoint = mode === 'edit' ? '/api/source' : mode === 'comment' ? '/api/comment' : '/api/status';
    const body = { path, expectedRevision: base.revision, ...(mode === 'edit' ? { content: draft } : mode === 'comment' ? { comment: draft } : { status: label.trim() || null }) };
    mutation.mutate({ endpoint, body, document: base }, { onSuccess: () => { allow(); if (recovery) client.getMutationCache().getAll().filter(m => String(m.mutationId) === recovery).forEach(m => client.getMutationCache().remove(m)); onClose(); } });
  }}><Text fontSize="xs" color="fg.muted" mb="3">{path}</Text>
    {!base ? <Text role="status">{query.isError ? query.error.message : 'Reading document…'}</Text> : <fieldset disabled={busy}>
      {changed && <Box p="3" mb="3" borderWidth="1px"><Text role="alert">The document changed on disk. Your draft is kept. Review the latest source before saving.</Text><Box as="pre" fontSize="xs" whiteSpace="pre-wrap" maxH="40" overflow="auto">{query.data?.content ?? 'Document unavailable.'}</Box><Button size="xs" disabled={!query.data} onClick={() => { if (query.data && window.confirm('Use the latest revision with your draft? Review overlapping changes before saving.')) { setBase(query.data); mutation.reset(); } }}>Reapply mine on latest</Button><Button size="xs" variant="ghost" onClick={() => { if (query.data && window.confirm('Discard your draft and use the latest source?')) { setBase(query.data); setDraft(mode === 'edit' ? query.data.content : ''); setLabel(query.data.status.key.startsWith('value:') ? query.data.status.label : ''); if (recovery) client.getMutationCache().getAll().filter(m => String(m.mutationId) === recovery).forEach(m => client.getMutationCache().remove(m)); mutation.reset(); } }}>Discard mine</Button></Box>}
      {mode === 'status' ? <><Text fontSize="sm">{base.status.reason}</Text><label>Status<Input aria-label="Status label" value={label} onChange={event => setLabel(event.target.value)} placeholder="No status (leave blank)" /></label></> : <MarkdownEditor body={draft} previewLabel="Document draft preview"><Textarea aria-label={mode === 'edit' ? 'Markdown source' : 'Comment'} fontFamily="mono" fontSize="xs" value={draft} onChange={event => setDraft(event.target.value)} /></MarkdownEditor>}
      {mutation.isError && <Text role="alert" my="3">{mutation.error.message} Your draft is kept. Reload and review before another explicit save; a lost response may already have saved.</Text>}
      <Button type="submit" mt="4" disabled={!dirty || !!changed || !query.data || (mode === 'status' && !base.status.writable)} loading={mutation.isPending}>{mode === 'comment' ? 'Append comment' : mode === 'status' ? 'Save status' : 'Save document'}</Button>
    </fieldset>}
  </Box></Overlay>;
}

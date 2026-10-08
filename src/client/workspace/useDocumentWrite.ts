import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { openedDocumentSchema, type DocumentList, type OpenedDocument } from '../../server/document-types';
import { appendIssueComment } from '../../server/document';
import { diskKey, readJson } from '../ClientState';
import { authoredKey } from './status-model';
import type { Document } from './model';

type Write = { endpoint: string; body: Record<string, unknown>; document?: Document | OpenedDocument; status?: string | null };
export function useDocumentWrite(sessionToken?: string) {
  const client = useQueryClient();
  const busy = useIsMutating({ mutationKey: ['write'] }) > 0;
  const mutation = useMutation({ mutationKey: ['write', 'document'], retry: false,
    mutationFn: async (write: Write) => {
      if (!sessionToken) throw new Error('Reload the local session before saving.');
      const response = await fetch(write.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': sessionToken }, body: JSON.stringify(write.body) });
      const value = await response.json();
      if (!response.ok) throw new Error(String(value.error ?? 'Save failed. Reload and review before retrying.'));
      if (write.endpoint === '/api/folders') return value as { path: string };
      const path = typeof value.path === 'string' ? value.path : String(write.body.path);
      return readJson('/api/document?' + new URLSearchParams({ path }), openedDocumentSchema);
    },
    onMutate: async (write) => {
      await client.cancelQueries({ queryKey: diskKey });
      const previous = client.getQueriesData<DocumentList>({ queryKey: [...diskKey, 'documents'] });
      const opened = client.getQueriesData<OpenedDocument>({ queryKey: [...diskKey, 'document'] });
      if (write.document && write.document.content !== null && ['/api/source', '/api/comment'].includes(write.endpoint)) {
        let content = write.endpoint === '/api/source' ? String(write.body.content) : write.document.content;
        if (write.endpoint === '/api/comment') { try { content = appendIssueComment(content, String(write.body.comment)); } catch { /* The server reports unsafe section boundaries without a guessed preview. */ } }
        const body = content.replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/, '');
        client.setQueryData<OpenedDocument>([...diskKey, 'document', write.document.path], data => data && ({ ...data, content, body }));
        client.setQueriesData<DocumentList>({ queryKey: [...diskKey, 'documents'] }, data => data && ({ ...data, documents: data.documents.map(doc => doc.path === write.document?.path ? { ...doc, content } : doc) }));
      }
      if (write.document && write.status !== undefined) {
        const status = { key: write.status === null ? '@none' : authoredKey(write.status), label: write.status ?? 'No status', writable: false, reason: 'Saving status…' };
        client.setQueriesData<DocumentList>({ queryKey: [...diskKey, 'documents'] }, data => data && ({ ...data, documents: data.documents.map(doc => doc.path === write.document?.path ? { ...doc, status } : doc) }));
      }
      if (write.endpoint === '/api/documents/create') {
        const path = [write.body.folder, write.body.filename].filter(Boolean).join('/');
        client.setQueriesData<DocumentList>({ queryKey: [...diskKey, 'documents'] }, data => data && (data.hidden.some(folder => path.startsWith(folder + '/')) ? data : { ...data, documents: [...data.documents, { path, name: String(write.body.filename), folder: String(write.body.folder) || '.', title: String(write.body.title), kind: 'document', feature: null, location: null, content: null, revision: null, properties: [], diagnostics: [], status: { key: write.body.status ? authoredKey(String(write.body.status)) : '@none', label: String(write.body.status || 'No status'), writable: false, reason: 'Creating…' } }] }));
      }
      return { previous, opened };
    },
    onError: (_error, _write, snapshot) => { for (const [key, data] of [...(snapshot?.previous ?? []), ...(snapshot?.opened ?? [])]) client.setQueryData(key, data); },
    onSuccess: value => { if ('content' in value) client.setQueryData([...diskKey, 'document', value.path], value); },
    onSettled: () => { void client.invalidateQueries({ queryKey: diskKey }); },
  });
  return { mutation, busy };
}

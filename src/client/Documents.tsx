import { useEffect, useRef, useState } from 'react';
import { documentLinkSchema, documentListSchema, openedDocumentSchema, type DocumentLink, type OpenedDocument, type SupportingDocument } from '../server/document-types.js';
import { useDiskQuery, diskKey } from './ClientState';
import { SafeMarkdown } from './SafeMarkdown';

const groups = [
  ['specification', 'Specifications'], ['map', 'Wayfinding maps'], ['adr', 'Architectural decisions'],
] as const;

async function fetchJson(url: string): Promise<{ ok: boolean; value: unknown }> {
  const response = await fetch(url);
  return { ok: response.ok, value: await response.json() as unknown };
}
const errorOf = (value: unknown, fallback: string): string =>
  typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string' ? value.error : fallback;

/** File events and focus invalidate the cached supporting-document list. */
export function useSupportingDocuments() {
  const query = useDiskQuery([...diskKey, 'documents'], '/api/documents', documentListSchema);
  return { documents: query.data?.documents ?? [], failed: query.isError };
}

export function DocumentList({ documents, failed, onOpen }: { documents: SupportingDocument[]; failed: boolean; onOpen: (path: string) => void }) {
  if (documents.length === 0 && !failed) return null;
  return <section className="documents" aria-labelledby="documents-heading">
    <h2 id="documents-heading">Supporting documents <span className="count">{documents.length}</span></h2>
    <p className="muted">Read-only context for issues. These are never issue cards.</p>
    {failed && <p role="alert">Could not read supporting documents. Check folder access and the local server, then reload.</p>}
    {groups.map(([kind, label]) => {
      const entries = documents.filter((document) => document.kind === kind);
      if (entries.length === 0) return null;
      return <div key={kind} className="document-group"><h3>{label}</h3>
        <ul>{entries.map((document) => <li key={document.path}>
          <button className="text-link" onClick={() => onOpen(document.path)}>{document.title}</button>
          {' '}<span className="path">{document.path}</span>
        </li>)}</ul></div>;
    })}
  </section>;
}

export type DocumentTarget = { path: string; fragment: string | null };

/** Resolves a relative link from its source document. Failures are reported as unavailable, never as a guess. */
export async function resolveLink(from: string, href: string): Promise<DocumentLink> {
  try {
    const { ok, value } = await fetchJson(`/api/document-link?${new URLSearchParams({ from, href })}`);
    if (!ok) return { status: 'unavailable', reason: errorOf(value, 'The link could not be resolved.') };
    return documentLinkSchema.parse(value);
  } catch { return { status: 'unavailable', reason: 'The link could not be resolved. Check the local server and try again.' }; }
}

type Loaded = { state: 'loading' } | { state: 'ready'; document: OpenedDocument } | { state: 'unavailable'; reason: string };

/** Read-only panel: cached content stays visible while a query refreshes from disk. */
export function DocumentPanel({ target, notice, onLink, onClose, onBack, backLabel }: {
  target: DocumentTarget; notice: string | null; onLink: (from: string, href: string) => void; onClose: () => void;
  onBack?: (() => void) | undefined; backLabel?: string | undefined;
}) {
  const query = useDiskQuery([...diskKey, 'document', target.path], `/api/document?${new URLSearchParams({ path: target.path })}`, openedDocumentSchema);
  const [missingFragment, setMissingFragment] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); panel.current?.scrollTo?.(0, 0); setMissingFragment(null); }, [target.path]);
  const loaded: Loaded = query.isError ? { state: 'unavailable', reason: query.error.message } : query.data ? { state: 'ready', document: query.data } : { state: 'loading' };
  const opened = loaded.state === 'ready' ? loaded.document : null;
  return <aside className="issue-details document-details" aria-label="Supporting document" tabIndex={-1} ref={panel}
    onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <div className="details-header">
      <h2>{opened?.title ?? 'Supporting document'}</h2>
      <button onClick={onClose} aria-label="Close supporting document">Close</button>
    </div>
    <dl className="issue-context">
      <dt>Type</dt><dd>{opened ? ({ specification: 'Specification', map: 'Wayfinding map', adr: 'Architectural decision', document: 'Document' })[opened.kind] : '…'} · read-only</dd>
      <dt>File</dt><dd className="path">{target.path}</dd>
    </dl>
    <p>
      {onBack && <button onClick={onBack}>{backLabel ?? 'Back'}</button>}
      <button onClick={() => void query.refetch()}>Reload document</button>
    </p>
    {notice && <p role="alert">{notice}</p>}
    {missingFragment && <p role="status">The section “{missingFragment}” was not found in this document.</p>}
    {loaded.state === 'loading' && <p role="status">Loading document…</p>}
    {loaded.state === 'unavailable' && <p role="alert">Unavailable: {loaded.reason}</p>}
    {opened && <section className="markdown" aria-label="Document Markdown">
      <SafeMarkdown fragment={target.fragment} onLocalLink={(href) => onLink(target.path, href)} onMissingFragment={setMissingFragment}>{opened.content}</SafeMarkdown>
    </section>}
  </aside>;
}

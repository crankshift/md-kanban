import { useEffect, useRef, useState } from 'react';
import { documentLinkSchema, documentListSchema, openedDocumentSchema, type DocumentLink, type OpenedDocument, type SupportingDocument } from '../server/document-types.js';
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

/** Loads the supporting-document list; it reloads when the board changes or the window regains focus. */
export function useSupportingDocuments(boardVersion: unknown) {
  const [documents, setDocuments] = useState<SupportingDocument[]>([]);
  const [failed, setFailed] = useState(false);
  const requests = useRef(0);
  const alive = useRef(false);
  // Ignore responses that finish after the board is gone.
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function load() {
    const request = ++requests.current;
    try {
      const { ok, value } = await fetchJson('/api/documents');
      if (!ok) throw new Error(errorOf(value, 'Unavailable'));
      const list = documentListSchema.parse(value);
      if (alive.current && request === requests.current) { setDocuments((current) => JSON.stringify(current) === JSON.stringify(list.documents) ? current : list.documents); setFailed(false); }
    } catch { if (alive.current && request === requests.current) setFailed(true); }
  }
  useEffect(() => { void load(); }, [boardVersion]);
  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  return { documents, failed };
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

/** Read-only side panel. It re-reads the file whenever it opens, on focus, and on request, so it never serves a cached copy. */
export function DocumentPanel({ target, notice, onLink, onClose, onBack, backLabel }: {
  target: DocumentTarget; notice: string | null; onLink: (from: string, href: string) => void; onClose: () => void;
  onBack?: (() => void) | undefined; backLabel?: string | undefined;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [missingFragment, setMissingFragment] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const requests = useRef(0);
  async function read(path: string) {
    const request = ++requests.current;
    try {
      const { ok, value } = await fetchJson(`/api/document?${new URLSearchParams({ path })}`);
      if (request !== requests.current) return;
      setLoaded(ok ? { state: 'ready', document: openedDocumentSchema.parse(value) } : { state: 'unavailable', reason: errorOf(value, 'This document is unavailable.') });
    } catch { if (request === requests.current) setLoaded({ state: 'unavailable', reason: 'This document could not be read. Check the local server and try again.' }); }
  }
  useEffect(() => {
    setLoaded((current) => current.state === 'ready' && current.document.path === target.path ? current : { state: 'loading' });
    setMissingFragment(null);
    void read(target.path);
  }, [target.path, reloads]);
  useEffect(() => { panel.current?.focus(); panel.current?.scrollTo?.(0, 0); }, [target.path]);
  useEffect(() => {
    const onFocus = () => { void read(target.path); };
    window.addEventListener('focus', onFocus);
    return () => { requests.current++; window.removeEventListener('focus', onFocus); };
  }, [target.path]);
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
      <button onClick={() => setReloads((count) => count + 1)}>Reload document</button>
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

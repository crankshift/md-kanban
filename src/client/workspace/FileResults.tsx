import { LuChevronRight, LuFileText } from 'react-icons/lu';
import { Properties } from './Properties';
import type { Document } from './model';

export function FileResults({ documents, selected, onOpen }: { documents: Document[]; selected: string; onOpen: (path: string) => void }) {
  if (!documents.length) return <p className="workspace-empty">No matching Markdown files. Clear the filters to browse the collection.</p>;
  return <div className="file-list" aria-label="Markdown files">{documents.map((document) => <button type="button" key={document.path} className={`file-row ${document.path === selected ? 'is-selected' : ''}`} aria-label={`Read ${document.path}`} aria-pressed={document.path === selected} onClick={() => onOpen(document.path)}>
    <LuFileText /><span><strong>{document.title}</strong><small title={document.path}>{document.path}</small><Properties document={document} compact />{document.diagnostics.length > 0 && <small>{document.content === null ? 'Preview unavailable' : `${document.diagnostics.length} notice${document.diagnostics.length === 1 ? '' : 's'}`}</small>}</span><LuChevronRight className="file-chevron" />
  </button>)}</div>;
}

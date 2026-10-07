import { toaster } from './components/ui/toaster';
import { Box, Button, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import {
  documentLinkSchema,
  documentListSchema,
  openedDocumentSchema,
  type DocumentLink,
  type OpenedDocument,
  type SupportingDocument,
} from '../server/document-types.js';
import { useDiskQuery, diskKey } from './ClientState';
import { SafeMarkdown } from './SafeMarkdown';

const groups = [
  ['specification', 'Specifications'],
  ['map', 'Wayfinding maps'],
  ['adr', 'Architectural decisions'],
] as const;

async function fetchJson(url: string): Promise<{ ok: boolean; value: unknown }> {
  const response = await fetch(url);
  return { ok: response.ok, value: (await response.json()) as unknown };
}
const errorOf = (value: unknown, fallback: string): string =>
  typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
    ? value.error
    : fallback;

/** File events and focus invalidate the cached supporting-document list. */
export function useSupportingDocuments() {
  const query = useDiskQuery([...diskKey, 'documents'], '/api/documents', documentListSchema);
  return { documents: query.data?.documents ?? [], failed: query.isError };
}

export function DocumentList({
  documents,
  failed,
  onOpen,
}: {
  documents: SupportingDocument[];
  failed: boolean;
  onOpen: (path: string) => void;
}) {
  if (documents.length === 0 && !failed) return null;
  return (
    <section aria-label="Supporting documents" aria-labelledby="documents-heading">
      <Heading size="xs" mt="4" mb="2" id="documents-heading">
        Supporting documents ({documents.length})
      </Heading>
      {failed && (
        <p role="alert">
          Could not read supporting documents. Check folder access and the local server, then
          reload.
        </p>
      )}
      {groups.map(([kind, label]) => {
        const entries = documents.filter((document) => document.kind === kind);
        if (entries.length === 0) return null;
        return (
          <div key={kind} className="document-group">
            <Text aria-label="Document group" fontSize="xs" color="fg.muted" mt="3" mb="1">
              {label}
            </Text>
            <ul>
              {entries.map((document) => (
                <li key={document.path}>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="fg"
                    justifyContent="start"
                    whiteSpace="normal"
                    textAlign="start"
                    h="auto"
                    py="1"
                    onClick={() => onOpen(document.path)}
                  >
                    {document.title}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export type DocumentTarget = { path: string; fragment: string | null };

/** Resolves a relative link from its source document. Failures are reported as unavailable, never as a guess. */
export async function resolveLink(from: string, href: string): Promise<DocumentLink> {
  try {
    const { ok, value } = await fetchJson(
      `/api/document-link?${new URLSearchParams({ from, href })}`,
    );
    if (!ok)
      return { status: 'unavailable', reason: errorOf(value, 'The link could not be resolved.') };
    return documentLinkSchema.parse(value);
  } catch {
    return {
      status: 'unavailable',
      reason: 'The link could not be resolved. Check the local server and try again.',
    };
  }
}

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; document: OpenedDocument }
  | { state: 'unavailable'; reason: string };

/** Read-only panel: cached content stays visible while a query refreshes from disk. */
export function DocumentPanel({
  target,
  notice,
  onLink,
  onClose,
  onBack,
  backLabel,
}: {
  target: DocumentTarget;
  notice: string | null;
  onLink: (from: string, href: string) => void;
  onClose: () => void;
  onBack?: (() => void) | undefined;
  backLabel?: string | undefined;
}) {
  const query = useDiskQuery(
    [...diskKey, 'document', target.path],
    `/api/document?${new URLSearchParams({ path: target.path })}`,
    openedDocumentSchema,
  );
  const [missingFragment, setMissingFragment] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
    panel.current?.scrollTo?.(0, 0);
    setMissingFragment(null);
  }, [target.path]);
  const loaded: Loaded = query.isError
    ? { state: 'unavailable', reason: query.error.message }
    : query.data
      ? { state: 'ready', document: query.data }
      : { state: 'loading' };
  const opened = loaded.state === 'ready' ? loaded.document : null;
  useEffect(() => {
    const id = `document-read:${target.path}`;
    if (query.isError)
      toaster.create({
        id,
        type: 'error',
        title: 'Cannot read supporting document',
        description: query.error.message,
        duration: Infinity,
        closable: true,
      });
    else toaster.dismiss(id);
  }, [target.path, query.isError, query.error]);
  return (
    <aside
      className="issue-details document-details"
      aria-label="Supporting document"
      tabIndex={-1}
      ref={panel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="details-header">
        <Heading size="lg" mb="4">
          {opened?.title ?? 'Supporting document'}
        </Heading>
      </div>
      <dl className="issue-context">
        <dt>Type</dt>
        <dd>
          {opened
            ? {
                specification: 'Specification',
                map: 'Wayfinding map',
                adr: 'Architectural decision',
                document: 'Document',
              }[opened.kind]
            : '…'}{' '}
          · read-only
        </dd>
        <dt>File</dt>
        <Box as="dd" fontFamily="mono" fontSize="xs">
          {target.path}
        </Box>
      </dl>
      <HStack mt="3" mb="3" gap="2" flexWrap="wrap">
        {onBack && <Button size="sm" variant="subtle" onClick={onBack}>{backLabel ?? 'Back'}</Button>}
        <Button size="sm" variant="subtle" onClick={() => void query.refetch()}>Reload document</Button>
      </HStack>
      {notice && <p role="alert">{notice}</p>}
      {missingFragment && (
        <p role="status">The section “{missingFragment}” was not found in this document.</p>
      )}
      {loaded.state === 'loading' && <p role="status">Loading document…</p>}
      {loaded.state === 'unavailable' && <p role="alert">Unavailable: {loaded.reason}</p>}
      {opened && (
        <section className="markdown" aria-label="Document Markdown">
          <SafeMarkdown
            fragment={target.fragment}
            onLocalLink={(href) => onLink(target.path, href)}
            onMissingFragment={setMissingFragment}
          >
            {opened.content}
          </SafeMarkdown>
        </section>
      )}
    </aside>
  );
}

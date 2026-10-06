import { Box, Grid, Heading, Stack, Text } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import { SafeMarkdown } from './SafeMarkdown';
import { IssueEditor, type IssueDraft, type EditorActions } from './IssueEditor';
import type { Issue } from '../server/board.js';
import { DependencyList } from './Dependencies';
import { StatusControl, type StatusControls } from './StatusControl';

export function IssueDetails({
  issue: currentIssue,
  id,
  issues,
  onSelect,
  onClose,
  onStatusChange,
  savingId,
  editor,
  notice,
  onLink,
}: StatusControls & {
  id: string;
  issue: Issue | undefined;
  issues: Issue[];
  onSelect: (id: string) => void;
  onClose: () => void;
  editor?: EditorActions | undefined;
  notice?: string | null | undefined;
  onLink?: ((from: string, href: string) => void) | undefined;
}) {
  const last = useRef(currentIssue);
  if (currentIssue) last.current = currentIssue;
  const issue =
    currentIssue ??
    (last.current
      ? {
          ...last.current,
          content: null,
          revision: null,
          diagnostics: [
            'The file was removed, renamed, or moved outside the app. Copy your draft before closing.',
          ],
        }
      : undefined);
  if (!issue)
    return <MissingIssue id={id} draft={undefined} onClose={onClose} onDiscard={onClose} />;
  return (
    <OpenedIssue
      issue={issue}
      issues={issues}
      onSelect={onSelect}
      onClose={onClose}
      onStatusChange={onStatusChange}
      savingId={savingId}
      editor={editor}
      notice={notice}
      onLink={onLink}
    />
  );
}
function OpenedIssue({
  issue,
  issues,
  onSelect,
  onClose,
  onStatusChange,
  savingId,
  editor,
  notice,
  onLink,
}: StatusControls & {
  issue: Issue;
  issues: Issue[];
  onSelect: (id: string) => void;
  onClose: () => void;
  editor?: EditorActions | undefined;
  notice?: string | null | undefined;
  onLink?: ((from: string, href: string) => void) | undefined;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
    panel.current?.scrollTo?.(0, 0);
  }, [issue.id]);
  return (
    <aside
      className="issue-details"
      aria-label="Issue details"
      tabIndex={-1}
      ref={panel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="details-header">
        <Heading size="lg" mb="4">
          #{issue.number}: {issue.title}
        </Heading>
      </div>
      <Grid
        templateColumns={{ base: '1fr', md: 'minmax(0, 1fr) 15rem' }}
        gap="6"
        alignItems="start"
      >
        <Stack gap="4" minW="0">
          {notice && <p role="alert">{notice}</p>}
          {issue.diagnostics.length > 0 && (
            <ul role="alert">
              {issue.diagnostics.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          <section className="markdown" aria-label="Issue Markdown and comments">
            {issue.content === null ? (
              <p>Original text is unavailable because the file could not be read.</p>
            ) : (
              <SafeMarkdown onLocalLink={onLink && ((href) => onLink(issue.path, href))}>
                {issue.content}
              </SafeMarkdown>
            )}
          </section>
          {editor && (
            <IssueEditor
              key={issue.id}
              issue={issue}
              issues={issues}
              saving={!!savingId}
              {...editor}
            />
          )}
        </Stack>
        <Box as="aside" aria-label="Issue metadata">
          {' '}
          <Box
            as="dl"
            fontSize="sm"
            css={{
              '& dt': { color: 'fg.muted', marginTop: '0.75rem' },
              '& dd': { overflowWrap: 'anywhere' },
            }}
          >
            <dt>Status</dt>
            <dd>
              {issue.status ?? 'Unavailable'} · {issue.workflow ?? 'Needs attention'}
            </dd>
            <dt>{issue.workflow === 'wayfinding' ? 'Effort' : 'Feature'}</dt>
            <dd>{issue.feature}</dd>
            <dt>Location</dt>
            <Box as="dd" fontFamily="mono" fontSize="xs">
              {issue.location}
            </Box>
            <dt>File</dt>
            <Box as="dd" fontFamily="mono" fontSize="xs">
              {issue.path}
            </Box>
          </Box>
          <StatusControl issue={issue} onStatusChange={onStatusChange} savingId={savingId} />
          <DependencyList issue={issue} issues={issues} onSelect={onSelect} />
        </Box>
      </Grid>
    </aside>
  );
}

// Shown while the open issue's file is absent. It stays open so the issue returns in place if the file reappears,
// for example after a delete-and-recreate by another tool.
export function MissingIssue({
  id,
  draft,
  onClose,
  onDiscard,
}: {
  id: string;
  draft: IssueDraft | undefined;
  onClose: () => void;
  onDiscard: () => void;
}) {
  return (
    <aside
      className="issue-details"
      aria-label="Issue details"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="details-header">
        <h2>{draft ? `#${draft.base.number}: ${draft.base.title}` : 'Issue unavailable'}</h2>
      </div>
      <p role="alert">
        The file <span className="path">{id}</span> was removed, renamed, or moved outside the app.
        {draft
          ? ' Your unsaved draft is retained below; copy it before discarding. If the file was renamed, find the new file on the board and apply the changes there.'
          : ' If it reappears, this panel shows it again; if it was renamed, find the new file on the board.'}
      </p>
      {draft && (
        <>
          <textarea
            aria-label="Recoverable draft of removed issue"
            readOnly
            rows={14}
            value={JSON.stringify(draft.values, null, 2)}
          />
          <button onClick={onDiscard}>Discard draft</button>
        </>
      )}
    </aside>
  );
}

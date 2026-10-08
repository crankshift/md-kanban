import { Button, Text } from '@chakra-ui/react';
import { Overlay } from './Overlay';
import { toaster } from './components/ui/toaster';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useLocation, useNavigate } from 'react-router';
import { boardKey, diskKey, useDiskQuery } from './ClientState';
import { appendIssueComment, patchIssueBody, repairMarkdown } from '../server/document.js';
import {
  boardSchema,
  issueSchema,
  compareIssues,
  type BoardData,
  type Issue,
  type IssueCreate,
} from '../server/board.js';
import { resolveLink } from './workspace/links';
import type { IssueEditorActions, IssueDraft } from './IssueEditor';

const IssueCreator = lazy(() =>
  import('./IssueCreator').then((module) => ({ default: module.IssueCreator })),
);
const IssueDetails = lazy(() =>
  import('./IssueDetails').then((module) => ({ default: module.IssueDetails })),
);

export function IssueTools({
  data: initialData,
  sessionToken,
  sessionProblem = false,
}: {
  data: BoardData;
  sessionToken?: string | undefined;
  sessionProblem?: boolean;
}) {
  const client = useQueryClient();
  const board = useDiskQuery(boardKey, '/api/issues', boardSchema, initialData);
  const data = board.data ?? initialData;
  const route = useLocation();
  const panelParams = new URLSearchParams(route.search);
  const selectedId = panelParams.get('issue');
  const creating = panelParams.get('create') === 'true';
  const navigate = useNavigate();
  function setView(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const nextPath = params.get('issue');
    const trail: string[] = nextPath ? (route.state?.trail ?? []) : [];
    const followed = selectedId && nextPath && selectedId !== nextPath;
    return navigate(
      { search: params.toString() },
      {
        state: {
          trail: followed ? [...trail, selectedId] : trail,
          from: followed ? 'issue' : nextPath ? (route.state?.from ?? null) : null,
        },
      },
    );
  }
  const setCreating = (value: boolean) => {
    void setView({ create: value ? 'true' : null, issue: null });
  };
  // Navigation reads this guard synchronously, including immediately after a successful creation.
  // Draft values still belong exclusively to the mounted editor/creation form.
  const dirty = useRef(false);
  const setDirty = (value: boolean) => {
    dirty.current = value;
  };
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty.current &&
      ['issue', 'create', 'file'].some(
        (key) =>
          new URLSearchParams(currentLocation.search).get(key) !==
          new URLSearchParams(nextLocation.search).get(key),
      ),
  );
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Discard unsaved changes and close this editor?')) {
        setDirty(false);
        blocker.proceed();
      } else blocker.reset();
    }
  }, [blocker]);
  const [result, setResult] = useState<{ error: boolean; message: string } | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selected = data.issues.find((issue) => issue.id === selectedId);
  type Write = {
    base?: Issue;
    endpoint: 'status' | 'edit' | 'comment' | 'create' | 'repair';
    fields: Record<string, unknown>;
    submitted?: IssueDraft | undefined;
  };
  const mutation = useMutation({
    mutationKey: ['write'],
    mutationFn: async ({ base, endpoint, fields }: Write) => {
      if (!sessionToken) throw new Error('Reload the local session before saving.');
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mdboard-Session': sessionToken },
        body: JSON.stringify(
          base ? { path: base.path, expectedRevision: base.revision, ...fields } : fields,
        ),
      });
      const value: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          typeof value === 'object' && value !== null && 'error' in value
            ? String(value.error)
            : 'Save rejected.',
        );
      const saved = issueSchema.parse(value);
      if (!saved.revision || (base && saved.id !== base.id))
        throw new Error('Cannot confirm save.');
      return saved;
    },
    onMutate: async (request) => {
      await client.cancelQueries({ queryKey: diskKey });
      const previous = client.getQueryData<BoardData>(boardKey)!;
      const { base, endpoint, fields } = request;
      let optimistic: Issue;
      if (!base) {
        const creation = fields as IssueCreate;
        const sample = previous.issues.find((issue) => issue.container === creation.container)!;
        optimistic = {
          ...sample,
          id: 'creating',
          path: 'creating',
          number: null,
          title: creation.title,
          status: creation.status,
          workflow: creation.workflow,
          content: creation.body,
          revision: null,
          diagnostics: [],
          dependencyText: null,
        };
      } else {
        optimistic = { ...base };
        if (endpoint === 'repair') optimistic.content = repairMarkdown(base.content!, fields as import('./FixPanel').RepairFields);
        if (endpoint === 'status') optimistic.status = String(fields.status);
        if (endpoint === 'comment')
          optimistic.content = appendIssueComment(base.content!, String(fields.comment));
        if (endpoint === 'edit') {
          const changes = fields.changes as import('../server/board.js').IssueChanges;
          if (changes.title !== undefined) optimistic.title = changes.title;
          if (changes.status !== undefined) optimistic.status = changes.status;
          if (changes.body !== undefined)
            optimistic.content = patchIssueBody(base.content!, changes.body);
          if (changes.dependencies !== undefined)
            optimistic.dependencyText = changes.dependencies
              .map((id) => previous.issues.find((issue) => issue.id === id)?.number)
              .join(', ');
        }
      }
      client.setQueryData<BoardData>(boardKey, {
        ...previous,
        issues: base
          ? previous.issues.map((issue) => (issue.id === base.id ? optimistic : issue))
          : [...previous.issues, optimistic],
      });
      setResult(null);
      return { previous };
    },
    onError: (error, request, context) => {
      if (context) client.setQueryData(boardKey, context.previous);
      toaster.create({
        type: 'error',
        title: 'Save rejected',
        description: error.message,
        duration: Infinity,
        closable: true,
      });
      setResult({
        error: true,
        message: `${request.endpoint === 'status' ? 'Status was not saved.' : 'Save rejected.'} ${error.message} Could not confirm persistence; review latest Markdown before retrying, especially comments. Your draft is retained while its editor is open.`,
      });
    },
    onSuccess: (saved, request) => {
      for (const failed of client
        .getMutationCache()
        .findAll({ mutationKey: ['write'], status: 'error' })) {
        if (
          request.submitted &&
          (failed.state.variables as Write | undefined)?.base?.id === saved.id
        )
          client.getMutationCache().remove(failed);
      }
      client.setQueryData<BoardData>(boardKey, (current) => ({
        ...current!,
        issues: [
          ...current!.issues.filter((issue) => issue.id !== saved.id && issue.id !== 'creating'),
          saved,
        ].sort(compareIssues),
      }));
      toaster.create({
        type: request.endpoint === 'repair' && saved.diagnostics.length ? 'warning' : 'success',
        title:
          request.endpoint === 'repair'
            ? saved.diagnostics.length ? `#${saved.number} still needs attention` : `#${saved.number} is on the ${saved.workflow} board`
            : request.endpoint === 'comment'
            ? 'Comment appended'
            : request.endpoint === 'create'
              ? 'Issue created'
              : 'Issue saved',
      });
      setResult({
        error: false,
        message:
          request.endpoint === 'status'
            ? `#${saved.number}: ${saved.title} status saved as ${saved.status}.`
            : request.endpoint === 'comment'
              ? `Comment appended to #${saved.number}.`
              : `#${saved.number}: ${saved.title} saved.`,
      });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: diskKey });
    },
  });
  const failedWrites = useMutationState({
    filters: { mutationKey: ['write'], status: 'error' },
    select: (failed) => ({
      mutationId: failed.mutationId,
      request: failed.state.variables as Write,
    }),
  }).filter((failed) => failed.request.submitted);
  const recovery = failedWrites.filter((failed) => failed.request.base?.id === selectedId).at(-1)
    ?.request.submitted;
  function discardRecovery() {
    for (const failed of client
      .getMutationCache()
      .findAll({ mutationKey: ['write'], status: 'error' })) {
      if ((failed.state.variables as Write | undefined)?.base?.id === selectedId)
        client.getMutationCache().remove(failed);
    }
  }
  const savingId = mutation.isPending ? (mutation.variables?.base?.id ?? 'create') : null;
  const reloading = board.isFetching && !mutation.isPending;
  const outdated = board.isError || sessionProblem;
  useEffect(() => {
    if (outdated)
      toaster.create({
        id: 'board-read',
        type: 'error',
        title: 'Cannot refresh the board',
        description: 'Last data is shown. Your open draft is kept. Reconnect and reload issues.',
        duration: Infinity,
        closable: true,
      });
    else toaster.dismiss('board-read');
  }, [outdated]);
  async function reloadForUser() {
    await client.invalidateQueries({ queryKey: diskKey }, { throwOnError: true });
  }
  function write(request: Write) {
    if (client.isMutating({ mutationKey: ['write'] }))
      return Promise.reject(new Error('Wait for the current save before writing again.'));
    return mutation.mutateAsync(request);
  }
  const writeIssue: IssueEditorActions['onWrite'] = (base, endpoint, fields, submitted) =>
    write({ base, endpoint, fields, submitted });
  async function createNewIssue(request: IssueCreate) {
    const saved = await write({ endpoint: 'create', fields: request });
    setDirty(false);
    void setView({ issue: saved.id, create: null, file: saved.id, anchor: null });
  }
  function selectIssue(id: string) {
    const issue =
      data.issues.find((candidate) => candidate.id === id) ??
      failedWrites.find((failed) => failed.request.base?.id === id)?.request.base;
    if (!issue) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void setView({ issue: id, create: null, file: id, anchor: null });
    setLinkNotice(null);
  }
  async function followLink(from: string, href: string) {
    const link = await resolveLink(from, href);
    if (link.status === 'unavailable') {
      setLinkNotice(`Unavailable link “${href}”: ${link.reason}`);
      toaster.create({
        type: 'error',
        title: 'Unavailable link',
        description: link.reason,
        duration: Infinity,
        closable: true,
      });
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set('file', link.path);
    params.delete('issue');
    if (link.fragment) params.set('anchor', link.fragment); else params.delete('anchor');
    void navigate({ search: params.toString() });
  }
  function closeDetails() {
    void setView({ issue: null });
    setLinkNotice(null);
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
  }
  async function changeStatus(id: string, status: string, base?: Issue) {
    const issue = base ?? data.issues.find((candidate) => candidate.id === id);
    if (!sessionToken || !issue?.revision || issue.status === status || mutation.isPending) return;
    await write({ base: issue, endpoint: 'status', fields: { status } }).catch(() => {});
  }
  const onStatusChange = sessionToken
    ? (id: string, status: string, base?: Issue) => {
        void changeStatus(id, status, base);
      }
    : undefined;
  const overlays = <>
      <Overlay open={creating} title="Create issue" onClose={() => setCreating(false)}>
        {creating && (
          <Suspense fallback={null}>
            <IssueCreator
              visible
              onDirty={setDirty}
              issues={data.issues}
              saving={!!savingId || reloading}
              onClose={() => setCreating(false)}
              onCreate={createNewIssue}
              onReload={reloadForUser}
            />
          </Suspense>
        )}
      </Overlay>
      <Overlay open={!!selectedId} title="Issue details" onClose={closeDetails}>
        {route.state?.from && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              void navigate(-1);
            }}
          >
            Back to issue
          </Button>
        )}
        <Text aria-label="Detail breadcrumb" fontFamily="mono" fontSize="xs" mb="3">
          {[...(route.state?.trail ?? []), selectedId].filter(Boolean).join(' / ')}
        </Text>
        {result?.error && <Text role="alert">{result.message}</Text>}
        {selectedId && (
          <Suspense fallback={null}>
            <IssueDetails
              key={selectedId}
              id={selectedId}
              issue={
                selected ??
                (recovery
                  ? {
                      ...recovery.base,
                      content: null,
                      revision: null,
                      diagnostics: [
                        'The file is unavailable. Copy your submitted changes before closing.',
                      ],
                    }
                  : undefined)
              }
              issues={data.issues}
              onSelect={selectIssue}
              onClose={closeDetails}
              notice={linkNotice}
              onLink={(from, href) => {
                void followLink(from, href);
              }}
              onStatusChange={onStatusChange}
              savingId={savingId ?? (reloading ? 'reload' : null)}
              repair={sessionToken ? { onDirty: setDirty, onRepair: (base, fields) => write({ base, endpoint: 'repair', fields }) } : undefined}
              editor={
                sessionToken
                  ? {
                      onDirty: setDirty,
                      recovery,
                      onDiscardRecovery: discardRecovery,
                      onWrite: writeIssue,
                      onReload: reloadForUser,
                    }
                  : undefined
              }
            />
          </Suspense>
        )}
      </Overlay>
  </>;
  return <>
    {outdated && <Text role="alert">Cannot refresh issues: outdated data. Your draft is kept.</Text>}
    {result && <Text role={result.error ? 'alert' : 'status'}>{result.message}</Text>}
    {failedWrites.filter((failed) => failed.request.base?.id !== selectedId).map((failed) => <Button key={failed.mutationId} onClick={() => selectIssue(failed.request.base!.id)}>Reopen editor with submitted changes</Button>)}
    {overlays}
  </>;
}

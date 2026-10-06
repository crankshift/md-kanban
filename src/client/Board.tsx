import { Box, Button, Collapsible, Heading, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { DragCard, StatusDragBoard, StatusDropColumn } from './DragBoard';
import { Navigator, Overlay, featureKey } from './Navigator';
import { Picker } from './Picker';
import { toaster } from './components/ui/toaster';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useLocation, useNavigate } from 'react-router';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { boardKey, diskKey, useDiskQuery } from './ClientState';
import { appendIssueComment, patchIssueBody } from '../server/document.js';
import {
  boardSchema,
  issueSchema,
  compareIssues,
  implementationStatuses,
  wayfindingStatuses,
  type BoardData,
  type Workflow,
  type Issue,
  type IssueCreate,
} from '../server/board.js';
import { resolveDependencies } from '../server/dependencies.js';
import { DependencyIndicators } from './Dependencies';
import {
  DocumentPanel,
  resolveLink,
  useSupportingDocuments,
  type DocumentTarget,
} from './Documents';
import { IssueCreator } from './IssueCreator';
import { IssueDetails } from './IssueDetails';
import { StatusControl, type StatusControls } from './StatusControl';
import type { IssueEditorActions, IssueDraft } from './IssueEditor';

type Filters = { query: string; location: string; feature: string };
const emptyFilters: Filters = { query: '', location: '', feature: '' };
export function BoardView({
  data,
  workflow,
  filters = emptyFilters,
  onSelect,
  onStatusChange,
  savingId,
  mode = 'board',
  attentionOnly = false,
}: StatusControls & {
  data: BoardData;
  workflow: Workflow;
  filters?: Filters;
  onSelect?: (id: string) => void;
  mode?: string;
  attentionOnly?: boolean;
}) {
  const statuses = workflow === 'implementation' ? implementationStatuses : wayfindingStatuses;
  const query = filters.query.trim().toLowerCase();
  const matching = data.issues.filter(
    (issue) =>
      (!filters.location || issue.location === filters.location) &&
      (!filters.feature || featureKey(issue) === filters.feature) &&
      (!query ||
        issue.title.toLowerCase().includes(query) ||
        issue.content?.toLowerCase().includes(query)),
  );
  const issues = matching
    .filter((issue) => issue.workflow === workflow && issue.diagnostics.length === 0)
    .sort(compareIssues);
  const attention = matching.filter((issue) => issue.diagnostics.length > 0).sort(compareIssues);
  if (attentionOnly)
    return (
      <Stack aria-label="Needs attention" p="6">
        {!attention.length && (
          <Text>No files need attention. Issues with unrecognized metadata will appear here.</Text>
        )}
        {attention.map((issue) => (
          <Box key={issue.id} borderWidth="1px" rounded="l2" p="3" bg="bg.panel">
            <Button variant="plain" onClick={() => onSelect?.(issue.id)}>
              {issue.title}
            </Button>
            <Text fontFamily="mono" fontSize="xs">
              {issue.path}
            </Text>
            {issue.diagnostics.map((reason) => (
              <Text key={reason} color="fg.warning">
                {reason}
              </Text>
            ))}
          </Box>
        ))}
      </Stack>
    );
  function card(issue: Issue) {
    const content = (
      <Box
        as="article"
        aria-label={`Issue #${issue.number ?? '?'}: ${issue.title}`}
        key={issue.id}
        bg="bg.panel"
        borderWidth="1px"
        rounded="l2"
        p="3"
        pb={mode === 'board' && onStatusChange ? '8' : '3'}
        _hover={{ borderColor: 'border.emphasized' }}
      >
        <HStack align="start">
          <Text aria-label="Issue number" fontFamily="mono" fontSize="xs" color="fg.muted" minW="7">
            {issue.number ? `#${issue.number}` : 'Creating…'}
          </Text>
          <Stack
            direction={mode === 'list' ? 'row' : 'column'}
            align={mode === 'list' ? 'center' : undefined}
            gap="2"
            flex="1"
            minW="0"
          >
            <Button
              variant="plain"
              color="fg"
              size="sm"
              whiteSpace="normal"
              textAlign="start"
              justifyContent="start"
              h="auto"
              flex={mode === 'list' ? '1' : undefined}
              aria-label={
                issue.number
                  ? `Open #${issue.number}: ${issue.title} · ${issue.path}`
                  : `Creating: ${issue.title}`
              }
              disabled={issue.id === 'creating'}
              onClick={() => onSelect?.(issue.id)}
            >
              {issue.title}
            </Button>
            {!filters.feature && (
              <Text fontSize="xs" color="fg.muted">
                {issue.feature}
              </Text>
            )}
            <DependencyIndicators dependencies={resolveDependencies(issue, data.issues)} />
          </Stack>
          <StatusControl
            compact
            issue={issue}
            onStatusChange={onStatusChange}
            savingId={savingId}
          />
        </HStack>
      </Box>
    );
    return mode === 'board' ? (
      <DragCard
        key={issue.id}
        issue={issue}
        disabled={!onStatusChange || !!savingId || !issue.revision || issue.id === 'creating'}
      >
        {content}
      </DragCard>
    ) : (
      content
    );
  }
  return (
    <StatusDragBoard workflow={workflow} onStatusChange={onStatusChange} savingId={savingId}>
      <Box p="6" pt="2">
        {data.warnings.map((warning) => (
          <Text role="alert" key={warning}>
            {warning}
          </Text>
        ))}
        {!issues.length && (
          <Text py="6">
            {query || filters.location || filters.feature
              ? `No ${workflow} issues match the current search and filters. Clear the filters to see more issues.`
              : `No ${workflow} issues found in this folder. Add an issue in an existing feature or effort to get started.`}
          </Text>
        )}
        <Box
          aria-label={`${workflow} ${mode}`}
          display={mode === 'board' ? 'grid' : 'block'}
          gridTemplateColumns={`repeat(${statuses.length}, minmax(12rem, 1fr))`}
          gap="3"
          minW="0"
        >
          {statuses.map((status) => {
            const column = issues.filter((issue) => issue.status === status);
            const title = (
              <HStack justify="space-between" mb="3">
                <Text fontWeight="medium">{status}</Text>
                <Text color="fg.muted">{column.length}</Text>
              </HStack>
            );
            return mode === 'list' ? (
              <Collapsible.Root key={status} defaultOpen mb="4">
                <Collapsible.Trigger asChild>
                  <Button
                    variant="ghost"
                    w="full"
                    justifyContent="start"
                    aria-label={`Toggle ${status}`}
                  >
                    {title}
                  </Button>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Stack gap="2">{column.map(card)}</Stack>
                </Collapsible.Content>
              </Collapsible.Root>
            ) : (
              <StatusDropColumn key={status} status={status} workflow={workflow}>
                {title}
                <Stack gap="2">
                  {column.map(card)}
                  {!column.length && (
                    <Text fontSize="xs" color="fg.muted" px="1">
                      No issues
                    </Text>
                  )}
                </Stack>
              </StatusDropColumn>
            );
          })}
        </Box>
      </Box>
    </StatusDragBoard>
  );
}

export function Board({
  data: initialData,
  sessionToken,
  folder,
  sessionProblem = false,
}: {
  data: BoardData;
  sessionToken?: string | undefined;
  folder?: string | undefined;
  sessionProblem?: boolean;
}) {
  const client = useQueryClient();
  const board = useDiskQuery(boardKey, '/api/issues', boardSchema, initialData);
  const data = board.data ?? initialData;
  const [view] = useQueryStates(
    {
      workflow: parseAsStringLiteral(['implementation', 'wayfinding']).withDefault(
        'implementation',
      ),
      query: parseAsString.withDefault(''),
      location: parseAsString.withDefault(''),
      feature: parseAsString.withDefault(''),
      mode: parseAsStringLiteral(['board', 'list']).withDefault('board'),
      sidebar: parseAsStringLiteral(['expanded', 'collapsed']).withDefault('expanded'),
      attention: parseAsString,
      issue: parseAsString,
      document: parseAsString,
      fragment: parseAsString,
      create: parseAsString,
    },
    { history: 'push' },
  );
  function setView(next: Partial<typeof view>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const currentPath = selectedId ?? documentPath;
    const nextPath = params.get('issue') ?? params.get('document');
    const trail: string[] = nextPath ? (route.state?.trail ?? []) : [];
    const followed = currentPath && nextPath && currentPath !== nextPath;
    return navigate(
      { search: params.toString() },
      {
        state: {
          trail: followed ? [...trail, currentPath] : trail,
          from: followed
            ? selectedId
              ? 'issue'
              : 'document'
            : nextPath
              ? (route.state?.from ?? null)
              : null,
        },
      },
    );
  }
  const workflow = view.workflow;
  const filters = { query: view.query, location: view.location, feature: view.feature };
  const route = useLocation();
  const panelParams = new URLSearchParams(route.search);
  const selectedId = panelParams.get('issue');
  const creating = panelParams.get('create') === 'true';
  const documentPath = panelParams.get('document');
  const openDocument = documentPath
    ? { target: { path: documentPath, fragment: panelParams.get('fragment') } }
    : null;
  const setFilters = (filters: Filters) => {
    void setView(filters);
  };
  const setCreating = (value: boolean) => {
    void setView({ create: value ? 'true' : null, issue: null, document: null });
  };
  // Navigation reads this guard synchronously, including immediately after a successful creation.
  // Draft values still belong exclusively to the mounted editor/creation form.
  const dirty = useRef(false);
  const setDirty = (value: boolean) => {
    dirty.current = value;
  };
  const navigate = useNavigate();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty.current &&
      ['issue', 'document', 'create'].some(
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
  const [live, setLive] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const supporting = useSupportingDocuments();
  const selected = data.issues.find((issue) => issue.id === selectedId);
  const locations = [...new Set(data.issues.map((issue) => issue.location))].sort();
  const features = [
    ...new Map(
      data.issues
        .filter((issue) => !filters.location || issue.location === filters.location)
        .sort(compareIssues)
        .map((issue) => [featureKey(issue), issue]),
    ).entries(),
  ];
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/events');
    const sync = () => {
      setLive('live');
      void client.invalidateQueries({ queryKey: diskKey });
    };
    source.addEventListener('ready', sync);
    source.addEventListener('change', sync);
    source.addEventListener('error', () => setLive('offline'));
    return () => source.close();
  }, [client]);
  type Write = {
    base?: Issue;
    endpoint: 'status' | 'edit' | 'comment' | 'create';
    fields: Record<string, unknown>;
    submitted?: IssueDraft | undefined;
  };
  const mutation = useMutation({
    mutationKey: ['write'],
    mutationFn: async ({ base, endpoint, fields }: Write) => {
      if (!sessionToken) throw new Error('Reload the local session before saving.');
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Md-Kanban-Session': sessionToken },
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
        type: 'success',
        title:
          request.endpoint === 'comment'
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
  useEffect(() => {
    if (supporting.failed)
      toaster.create({
        id: 'document-list-read',
        type: 'error',
        title: 'Cannot refresh supporting documents',
        duration: Infinity,
        closable: true,
      });
    else toaster.dismiss('document-list-read');
  }, [supporting.failed]);
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
    void setView({
      workflow: saved.workflow!,
      ...emptyFilters,
      issue: saved.id,
      create: null,
      document: null,
    });
  }
  function selectIssue(id: string) {
    const issue =
      data.issues.find((candidate) => candidate.id === id) ??
      failedWrites.find((failed) => failed.request.base?.id === id)?.request.base;
    if (!issue) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void setView({
      issue: id,
      document: null,
      fragment: null,
      create: null,
      ...(issue.workflow ? { workflow: issue.workflow } : {}),
    });
    setLinkNotice(null);
  }
  function showDocument(target: DocumentTarget) {
    void setView({ document: target.path, fragment: target.fragment, issue: null, create: null });
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
    if (link.issue && data.issues.some((issue) => issue.id === link.path)) selectIssue(link.path);
    else showDocument({ path: link.path, fragment: link.fragment });
  }
  function closeDetails() {
    void setView({ issue: null, document: null, fragment: null });
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
  const attention = view.attention === 'true';
  const title = attention
    ? 'Needs attention'
    : (features.find(([key]) => key === filters.feature)?.[1].feature ??
      (filters.location || `All ${workflow === 'wayfinding' ? 'efforts' : 'features'}`));
  const detailOpen = !!(selectedId || openDocument);
  const detailTitle = selectedId ? 'Issue details' : 'Supporting document';
  return (
    <Navigator
      issues={data.issues}
      documents={supporting.documents}
      documentsFailed={supporting.failed}
      folder={folder}
      workflow={workflow}
      location={filters.location}
      feature={filters.feature}
      attention={attention}
      collapsed={view.sidebar === 'collapsed'}
      live={outdated ? 'outdated' : live}
      onCollapse={() => {
        void setView({ sidebar: view.sidebar === 'collapsed' ? 'expanded' : 'collapsed' });
      }}
      onWorkflow={(workflow) => {
        void setView({ workflow, attention: null, location: '', feature: '' });
      }}
      onScope={(location, feature) => {
        void setView({ location, feature, attention: null });
      }}
      onAttention={() => {
        void setView({ attention: 'true', ...emptyFilters });
      }}
      onIssue={selectIssue}
      onDocument={(path) => showDocument({ path, fragment: null })}
    >
      <HStack px="6" pt="5" pb="3" gap="4" flexWrap="wrap">
        <Stack gap="0">
          <Text fontSize="xs" color="fg.muted">
            {workflow === 'wayfinding' ? 'Wayfinding' : 'Implementation'}
          </Text>
          <Heading size="lg">{title}</Heading>
        </Stack>
        <HStack ms="auto" gap="2">
          <Input
            type="search"
            aria-label="Search issues"
            placeholder="Filter titles and bodies"
            w="60"
            size="sm"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          />
          <Button
            size="sm"
            variant={view.mode === 'board' ? 'subtle' : 'ghost'}
            aria-pressed={view.mode === 'board'}
            onClick={() => {
              void setView({ mode: 'board' });
            }}
          >
            Board
          </Button>
          <Button
            size="sm"
            variant={view.mode === 'list' ? 'subtle' : 'ghost'}
            aria-pressed={view.mode === 'list'}
            onClick={() => {
              void setView({ mode: 'list' });
            }}
          >
            List
          </Button>
          {sessionToken && (
            <Button size="sm" disabled={!!savingId || reloading} onClick={() => setCreating(true)}>
              New issue
            </Button>
          )}
        </HStack>
      </HStack>
      <HStack px="6" gap="3" aria-label="Search and filters">
        <Picker
          label="Location"
          items={[
            { value: '', label: 'All locations' },
            ...locations.map((value) => ({ value, label: value })),
          ]}
          value={[filters.location]}
          onChange={(values) => setFilters({ ...filters, location: values[0] ?? '', feature: '' })}
        />
        <Picker
          label={workflow === 'wayfinding' ? 'Effort' : 'Feature'}
          items={[
            { value: '', label: `All ${workflow === 'wayfinding' ? 'efforts' : 'features'}` },
            ...features.map(([value, issue]) => ({
              value,
              label: `${issue.feature} · ${issue.location}`,
            })),
          ]}
          value={[filters.feature]}
          onChange={(values) => setFilters({ ...filters, feature: values[0] ?? '' })}
        />
        <Button size="xs" variant="ghost" onClick={() => setFilters(emptyFilters)}>
          Clear search and filters
        </Button>
        {(outdated || live === 'offline') && (
          <Button
            size="xs"
            disabled={!!savingId || reloading}
            onClick={() => {
              void reloadForUser().catch(() => {});
            }}
          >
            Reload issues
          </Button>
        )}
      </HStack>
      {savingId && (
        <Text role="status" px="6">
          Saving issue…
        </Text>
      )}
      {outdated && (
        <Text role="alert" px="6">
          Cannot refresh issues. Last data is shown; your draft is kept. Reconnect and reload
          issues.
        </Text>
      )}
      {result && (
        <Text role={result.error ? 'alert' : 'status'} aria-live="polite" px="6">
          {result.message}
        </Text>
      )}
      {failedWrites
        .filter((failed) => failed.request.base?.id !== selectedId)
        .map((failed) => (
          <Button key={failed.mutationId} onClick={() => selectIssue(failed.request.base!.id)}>
            Reopen editor with submitted changes
          </Button>
        ))}
      <Box aria-busy={!!savingId || reloading}>
        <BoardView
          data={data}
          workflow={workflow}
          filters={filters}
          mode={view.mode}
          attentionOnly={attention}
          onSelect={selectIssue}
          onStatusChange={onStatusChange}
          savingId={savingId ?? (reloading ? 'reload' : null)}
        />
      </Box>
      <Overlay open={creating} title="Create issue" onClose={() => setCreating(false)}>
        {creating && (
          <IssueCreator
            visible
            onDirty={setDirty}
            issues={data.issues}
            saving={!!savingId || reloading}
            onClose={() => setCreating(false)}
            onCreate={createNewIssue}
            onReload={reloadForUser}
          />
        )}
      </Overlay>
      <Overlay open={detailOpen} title={detailTitle} onClose={closeDetails}>
        {route.state?.from && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              void navigate(-1);
            }}
          >
            {route.state.from === 'issue' ? 'Back to issue' : 'Back to previous document'}
          </Button>
        )}
        <Text aria-label="Detail breadcrumb" fontFamily="mono" fontSize="xs" mb="3">
          {[...(route.state?.trail ?? []), selectedId ?? documentPath].filter(Boolean).join(' / ')}
        </Text>
        {result?.error && <Text role="alert">{result.message}</Text>}
        {openDocument && (
          <DocumentPanel
            target={openDocument.target}
            notice={linkNotice}
            onClose={closeDetails}
            onLink={(from, href) => {
              void followLink(from, href);
            }}
          />
        )}
        {selectedId && (
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
        )}
      </Overlay>
    </Navigator>
  );
}

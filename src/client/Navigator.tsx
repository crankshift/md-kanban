import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  HStack,
  IconButton,
  Input,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import {
  LuBookOpen,
  LuCompass,
  LuKanban,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuSearch,
  LuTriangleAlert,
} from 'react-icons/lu';
import { ColorModeButton } from './components/ui/color-mode';
import { Tooltip } from './components/ui/tooltip';
import { DocumentList } from './Documents';
import { Picker } from './Picker';
import type { Issue, Workflow } from '../server/board.js';
import type { SupportingDocument } from '../server/document-types.js';
export const featureKey = (issue: Pick<Issue, 'location' | 'feature'>) =>
  JSON.stringify([issue.location, issue.feature]);
export function Overlay({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      initialFocusEl={() =>
        content.current?.querySelector<HTMLInputElement>('input:not(:disabled), textarea:not(:disabled)') ?? content.current
      }
      open={open}
      onOpenChange={(event) => {
        if (!event.open) onClose();
      }}
      placement="center"
      size="xl"
      scrollBehavior="inside"
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content ref={content} maxH="90dvh">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Button
                ms="auto"
                size="xs"
                variant="ghost"
                onClick={onClose}
                aria-label={`Close ${title}`}
              >
                Close
              </Button>
            </Dialog.Header>
            <Dialog.Body pb="6">{children}</Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
export function Navigator({
  issues,
  documents,
  documentsFailed,
  folder,
  workflow,
  location,
  feature,
  attention,
  collapsed,
  live,
  onCollapse,
  onWorkflow,
  onScope,
  onAttention,
  onDocument,
  onIssue,
  children,
}: {
  issues: Issue[];
  documents: SupportingDocument[];
  documentsFailed: boolean;
  folder?: string | undefined;
  workflow: Workflow;
  location: string;
  feature: string;
  attention: boolean;
  collapsed: boolean;
  live: string;
  onCollapse: () => void;
  onWorkflow: (value: Workflow) => void;
  onScope: (location: string, feature: string) => void;
  onAttention: () => void;
  onDocument: (path: string) => void;
  onIssue: (id: string) => void;
  children: ReactNode;
}) {
  const [palette, setPalette] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const hotkey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((value) => !value);
      }
      if (
        event.key === '[' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest('input, textarea, [contenteditable=true], [role=combobox]')
        )
      ) {
        event.preventDefault();
        onCollapse();
      }
    };
    window.addEventListener('keydown', hotkey);
    return () => window.removeEventListener('keydown', hotkey);
  }, [onCollapse]);
  const valid = issues.filter((issue) => issue.workflow === workflow && !issue.diagnostics.length);
  const locations = [...new Set(valid.map((issue) => issue.location))].sort();
  const features = [...new Map(valid.map((issue) => [featureKey(issue), issue])).values()];
  const nav = (
    label: string,
    icon: ReactNode,
    active: boolean,
    action: () => void,
    count?: number,
  ) =>
    collapsed ? (
      <Tooltip
        key={label}
        content={count === undefined ? label : `${label} (${count})`}
        positioning={{ placement: 'right' }}
      >
        <IconButton
          aria-label={label}
          size="sm"
          color={active ? 'colorPalette.fg' : 'fg'}
          variant={active ? 'subtle' : 'ghost'}
          onClick={action}
        >
          {icon}
        </IconButton>
      </Tooltip>
    ) : (
      <Button
        key={label}
        aria-label={label}
        size="sm"
        justifyContent="start"
        color={active ? 'colorPalette.fg' : 'fg'}
        variant={active ? 'subtle' : 'ghost'}
        onClick={action}
      >
        {icon}
        {label}
        {count !== undefined && (
          <Text ms="auto" color="fg.muted">
            {count}
          </Text>
        )}
      </Button>
    );
  const needle = query.trim().toLowerCase();
  const results = [
    ...issues
      .filter((issue) =>
        `${issue.number} ${issue.title} ${issue.content ?? ''}`.toLowerCase().includes(needle),
      )
      .map((issue) => ({
        id: issue.id,
        label: `#${issue.number ?? '?'}: ${issue.title}`,
        pick: () => onIssue(issue.id),
      })),
    ...documents
      .filter((doc) => `${doc.title} ${doc.path}`.toLowerCase().includes(needle))
      .map((doc) => ({ id: doc.path, label: doc.title, pick: () => onDocument(doc.path) })),
  ];
  return (
    <Box
      display="grid"
      gridTemplateColumns={collapsed ? '3.25rem minmax(0, 1fr)' : '16rem minmax(0, 1fr)'}
      h="100dvh"
    >
      <Flex
        as="nav"
        aria-label="Navigator"
        direction="column"
        bg="bg.panel"
        borderEndWidth="1px"
        p="2"
        gap="1"
        overflowY="auto"
        align={collapsed ? 'center' : undefined}
      >
        {collapsed ? (
          nav('Expand sidebar', <LuPanelLeftOpen />, false, onCollapse)
        ) : (
          <HStack justify="space-between" px="2">
            <Heading size="md">md-kanban</Heading>
            <Tooltip content="Collapse sidebar [">
              <IconButton
                aria-label="Collapse sidebar"
                size="xs"
                variant="ghost"
                color="fg.muted"
                onClick={onCollapse}
              >
                <LuPanelLeftClose />
              </IconButton>
            </Tooltip>
          </HStack>
        )}
        {!collapsed && (
          <Text px="2" fontFamily="mono" fontSize="xs" color="fg.muted" wordBreak="break-all">
            {folder ?? 'Selected folder'}
          </Text>
        )}
        {nav('Jump to…', <LuSearch />, false, () => setPalette(true))}
        {!collapsed && (
          <Text color="fg.muted" fontSize="xs" px="2" mt="3">
            Workflow
          </Text>
        )}
        {(['implementation', 'wayfinding'] as const).map((value) =>
          nav(
            `${value === 'implementation' ? 'Implementation' : 'Wayfinding'}`,
            value === 'implementation' ? <LuKanban /> : <LuCompass />,
            workflow === value && !attention,
            () => onWorkflow(value),
            issues.filter((issue) => issue.workflow === value && !issue.diagnostics.length).length,
          ),
        )}
        {nav(
          'Needs attention',
          <LuTriangleAlert />,
          attention,
          onAttention,
          issues.filter((issue) => issue.diagnostics.length).length,
        )}
        {!collapsed && (
          <Stack gap="1" mt="3">
            <Text fontSize="xs" color="fg.muted">
              {workflow === 'wayfinding' ? 'Efforts' : 'Features'}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              color="fg"
              justifyContent="start"
              onClick={() => onScope('', '')}
            >
              All
            </Button>
            {locations.map((path) => (
              <Stack gap="0" key={path}>
                <Button
                  size="xs"
                  variant="ghost"
                  color="fg.muted"
                  justifyContent="start"
                  fontFamily="mono"
                  onClick={() => onScope(path, '')}
                >
                  {path}
                </Button>
                {features
                  .filter((issue) => issue.location === path)
                  .map((issue) => (
                    <Button
                      key={featureKey(issue)}
                      size="sm"
                      justifyContent="start"
                      color={feature === featureKey(issue) ? 'colorPalette.fg' : 'fg'}
                      variant={feature === featureKey(issue) ? 'subtle' : 'ghost'}
                      onClick={() => onScope(path, featureKey(issue))}
                    >
                      {issue.feature}
                      <Text ms="auto">
                        {valid.filter((entry) => featureKey(entry) === featureKey(issue)).length}
                      </Text>
                    </Button>
                  ))}
              </Stack>
            ))}
          </Stack>
        )}
        {collapsed ? (
          nav('Documents', <LuBookOpen />, false, () => setDocsOpen(true))
        ) : (
          <DocumentList documents={documents} failed={documentsFailed} onOpen={onDocument} />
        )}
        {collapsed && nav('Locations and scopes', <LuCompass />, false, () => setDocsOpen(true))}
        <HStack mt="auto" pt="3" flexWrap="wrap">
          <Tooltip content={live}>
            <Text
              tabIndex={0}
              role="status"
              aria-label={`Connection: ${live}`}
              fontSize="xs"
              color={live === 'live' ? 'fg.success' : 'fg.warning'}
            >
              {collapsed ? '●' : live}
            </Text>
          </Tooltip>
          <Tooltip content="Toggle color mode">
            <ColorModeButton size="xs" />
          </Tooltip>
        </HStack>
      </Flex>
      <Flex as="main" direction="column" minW="0" overflow="auto">
        {children}
      </Flex>
      <Overlay open={docsOpen} title="Documents and scopes" onClose={() => setDocsOpen(false)}>
        <Picker
          label="Location"
          items={[
            { value: '', label: 'All locations' },
            ...locations.map((value) => ({ value, label: value })),
          ]}
          value={[location]}
          onChange={(values) => onScope(values[0] ?? '', '')}
        />
        <Picker
          label={workflow === 'wayfinding' ? 'Effort' : 'Feature'}
          items={features.map((issue) => ({
            value: featureKey(issue),
            label: `${issue.feature} · ${issue.location}`,
          }))}
          value={[feature]}
          onChange={(values) => onScope(location, values[0] ?? '')}
        />
        <DocumentList
          documents={documents}
          failed={documentsFailed}
          onOpen={(path) => {
            setDocsOpen(false);
            onDocument(path);
          }}
        />
      </Overlay>
      <Overlay open={palette} title="Jump to…" onClose={() => setPalette(false)}>
        <Input
          aria-label="Search issues and documents"
          placeholder="Search issues and documents"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>('[aria-label="Search results"] button')
                ?.focus();
            }
            if (event.key === 'Enter' && results[0]) {
              results[0].pick();
              setPalette(false);
            }
          }}
        />
        <Stack
          aria-label="Search results"
          mt="3"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = index + (event.key === 'ArrowDown' ? 1 : -1);
            if (next < 0)
              event.currentTarget.parentElement?.querySelector<HTMLInputElement>('input')?.focus();
            else buttons[Math.min(next, buttons.length - 1)]?.focus();
          }}
        >
          {results.length ? (
            results.map((entry) => (
              <Button
                key={entry.id}
                variant="ghost"
                justifyContent="start"
                onClick={() => {
                  entry.pick();
                  setPalette(false);
                }}
              >
                {entry.label}
              </Button>
            ))
          ) : (
            <Text>No matches. Try an issue title or document path.</Text>
          )}
        </Stack>
      </Overlay>
    </Box>
  );
}

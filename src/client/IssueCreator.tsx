import { Button, HStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  creationTargetSchema,
  issueCreateSchema,
  implementationStatuses,
  wayfindingStatuses,
  wayfindingType,
  type CreationTarget,
  type Issue,
  type IssueCreate,
} from '../server/board.js';
import { resolveDependencies } from '../server/dependencies.js';
import { diskKey, useDiskQuery } from './ClientState';
import { Picker, choices } from './Picker';
import { MarkdownEditor } from './MarkdownEditor';

type Values = {
  target: string;
  title: string;
  status: string;
  type: 'research' | 'prototype' | 'grilling' | 'task';
  body: string;
  dependencies: string[];
};
const defaults: Values = {
  target: '',
  title: '',
  status: 'needs-triage',
  type: 'task',
  body: '',
  dependencies: [],
};
const targetKey = (target: CreationTarget) => JSON.stringify([target.container, target.workflow]);

export function IssueCreator({
  visible,
  issues,
  saving,
  onClose,
  onCreate,
  onReload,
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
  visible: boolean;
  issues: Issue[];
  saving: boolean;
  onClose: () => void;
  onCreate: (request: IssueCreate) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const targetQuery = useDiskQuery(
    [...diskKey, 'targets'],
    '/api/creation-targets',
    z.array(creationTargetSchema),
  );
  const [targets, setTargets] = useState<CreationTarget[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    reset,
    handleSubmit,
    formState: { isDirty },
  } = useForm<Values>({ defaultValues: defaults });
  const values = watch();
  const selected = targets?.find((target) => targetKey(target) === values.target);
  const candidates = selected
    ? issues.filter(
        (issue) =>
          issue.feature === selected.feature &&
          issue.location === selected.location &&
          issue.number &&
          resolveDependencies({ ...issue, dependencyText: issue.number }, issues)[0]?.kind ===
            'linked',
      )
    : [];

  async function loadTargets(review = false) {
    setLoading(true);
    try {
      if (review) await onReload();
      const latest = (await targetQuery.refetch()).data;
      if (!latest) throw new Error('Cannot load creation folders. Your draft is retained.');
      setTargets(latest);
      setOutdated(false);
      if (!getValues('target') && latest[0]) {
        setValue('target', targetKey(latest[0]));
        setValue('status', latest[0].workflow === 'implementation' ? 'needs-triage' : 'open');
      }
      if (review)
        setMessage(
          'Latest containers loaded. Inspect the board for a previously saved issue after a lost response, and review dependencies before creating again.',
        );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Cannot load containers; draft retained.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (visible && targets === null && !loading) void loadTargets();
  }, [visible]);
  useEffect(() => {
    const latest = targetQuery.data;
    if (!latest) return;
    if (!isDirty) {
      setTargets(latest);
      setOutdated(false);
    } else {
      const same = latest.find((target) => selected && targetKey(target) === targetKey(selected));
      setOutdated(!!selected && same?.revision !== selected.revision);
    }
  }, [targetQuery.data]);
  useEffect(() => {
    onDirty(isDirty);
  }, [isDirty, onDirty]);
  useEffect(() => {
    if (!isDirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [isDirty]);
  async function submit(value: Values) {
    if (!selected) {
      setMessage(
        'Choose an available container with a recognized workflow. Your draft is retained.',
      );
      return;
    }
    const request = issueCreateSchema.safeParse({
      container: selected.container,
      workflow: selected.workflow,
      expectedRevision: selected.revision,
      title: value.title,
      status: value.status,
      body: value.body,
      dependencies: value.dependencies,
      ...(selected.workflow === 'wayfinding' ? { type: value.type } : {}),
    });
    if (!request.success) {
      setMessage(request.error.issues.map((issue) => issue.message).join('; '));
      return;
    }
    try {
      await onCreate(request.data);
      setOutdated(false);
      reset(defaults);
      setTargets(null);
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Creation failed. Your draft is retained.',
      );
    }
  }
  return (
    <section
      hidden={!visible}
      className="issue-creator"
      aria-label="Create issue"
      aria-busy={visible && loading}
    >
      {visible && (
        <>
          <h2>Create issue</h2>
          <Button size="sm" alignSelf="start" variant="ghost" mb="3" disabled={saving || loading} onClick={onClose}>
            Close creation
          </Button>
          {message && <p role="alert">{message}</p>}
          {outdated && (
            <p role="alert">
              The selected folder changed outside the app. Your draft is kept, but creating from the
              old snapshot will be rejected. Use Reload containers, keep draft to review the latest
              issues and dependencies first.
            </p>
          )}
          {targets?.length === 0 && (
            <p>
              No existing issue containers have a recognized workflow. Add a compatible numbered
              Markdown issue in your existing folder, then reload containers.
            </p>
          )}
          <form noValidate onSubmit={handleSubmit(submit)}>
            <fieldset disabled={saving || loading}>
              <Controller
                name="target"
                control={control}
                render={({ field }) => (
                  <Picker
                    label="New issue container"
                    displayLabel={selected?.workflow === 'wayfinding' ? 'Effort' : 'Feature'}
                    value={[field.value]}
                    disabled={saving || loading}
                    items={(targets ?? []).map((target) => ({
                      value: targetKey(target),
                      label: `${target.workflow === 'wayfinding' ? 'Effort' : 'Feature'}: ${target.feature} · ${target.container}`,
                    }))}
                    onChange={(values) => {
                      const key = values[0] ?? '';
                      field.onChange(key);
                      setValue('dependencies', [], { shouldDirty: true });
                      const target = targets?.find((target) => targetKey(target) === key);
                      setValue(
                        'status',
                        target?.workflow === 'wayfinding' ? 'open' : 'needs-triage',
                        { shouldDirty: true },
                      );
                    }}
                  />
                )}
              />
              <label>
                Title
                <input aria-label="New issue title" {...register('title')} />
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Picker
                    label="New issue status"
                    items={choices(
                      selected?.workflow === 'wayfinding'
                        ? wayfindingStatuses
                        : implementationStatuses,
                    )}
                    value={[field.value]}
                    disabled={saving || loading}
                    onChange={(values) => {
                      if (values[0]) field.onChange(values[0]);
                    }}
                  />
                )}
              />
              {selected?.workflow === 'wayfinding' && (
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Picker
                      label="New issue type"
                      items={choices(wayfindingType.options)}
                      value={[field.value]}
                      disabled={saving || loading}
                      onChange={(values) => {
                        if (values[0]) field.onChange(values[0]);
                      }}
                    />
                  )}
                />
              )}
              <Controller
                name="dependencies"
                control={control}
                render={({ field }) => (
                  <Picker
                    label="New issue dependencies"
                    multiple
                    value={field.value}
                    disabled={saving || loading}
                    items={candidates.map((issue) => ({
                      value: issue.id,
                      label: `#${issue.number}: ${issue.title} · ${issue.container}`,
                    }))}
                    onChange={field.onChange}
                  />
                )}
              />
              <MarkdownEditor body={values.body} previewLabel="New issue preview">
                <textarea aria-label="New issue body" {...register('body')} />
              </MarkdownEditor>
              <Button size="sm" alignSelf="start" variant="solid" type="submit" disabled={!selected}>
                Create issue
              </Button>
            </fieldset>
          </form>
          <HStack mt="4" gap="2" flexWrap="wrap" aria-label="Creation draft actions">
            <Button size="sm" alignSelf="start" variant="subtle"
              disabled={saving || loading}
              onClick={() => {
                void loadTargets(true);
              }}
            >
              Reload containers, keep draft
            </Button>
            <Button size="sm" alignSelf="start" variant="ghost"
              disabled={saving || loading}
              onClick={() => {
                reset({
                  ...defaults,
                  target: values.target,
                  status: selected?.workflow === 'wayfinding' ? 'open' : 'needs-triage',
                });
                setMessage(null);
              }}
            >
              Discard creation draft
            </Button>
          </HStack>
        </>
      )}
    </section>
  );
}

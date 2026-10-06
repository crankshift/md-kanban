import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { creationTargetSchema, issueCreateSchema, implementationStatuses, wayfindingStatuses, wayfindingType,
  type CreationTarget, type Issue, type IssueCreate } from '../server/board.js';
import { resolveDependencies } from '../server/dependencies.js';
import { SafeMarkdown } from './SafeMarkdown';

type Values = { target: string; title: string; status: string; type: 'research' | 'prototype' | 'grilling' | 'task'; body: string; dependencies: string[] };
const defaults: Values = { target: '', title: '', status: 'needs-triage', type: 'task', body: '', dependencies: [] };
const targetKey = (target: CreationTarget) => JSON.stringify([target.container, target.workflow]);

export function IssueCreator({ visible, issues, saving, onClose, onCreate, onReload }: {
  visible: boolean; issues: Issue[]; saving: boolean; onClose: () => void;
  onCreate: (request: IssueCreate) => Promise<void>; onReload: () => Promise<void>;
}) {
  const [targets, setTargets] = useState<CreationTarget[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [outdated, setOutdated] = useState(false);
  const epoch = useRef(0);
  const { register, control, watch, setValue, getValues, reset, handleSubmit, formState: { isDirty } } = useForm<Values>({ defaultValues: defaults });
  const values = watch();
  const selected = targets?.find((target) => targetKey(target) === values.target);
  const candidates = selected ? issues.filter((issue) => issue.feature === selected.feature && issue.location === selected.location && issue.number &&
    resolveDependencies({ ...issue, dependencyText: issue.number }, issues)[0]?.kind === 'linked') : [];

  async function loadTargets(review = false) {
    setLoading(true);
    try {
      if (review) await onReload();
      const response = await fetch('/api/creation-targets');
      if (!response.ok) throw new Error('Cannot load creation folders. Check the local server; your draft is retained.');
      const latest = z.array(creationTargetSchema).parse(await response.json());
      setTargets(latest);
      setOutdated(false);
      if (!getValues('target') && latest[0]) {
        setValue('target', targetKey(latest[0]));
        setValue('status', latest[0].workflow === 'implementation' ? 'needs-triage' : 'open');
      }
      if (review) setMessage('Latest containers loaded. Inspect the board for a previously saved issue after a lost response, and review dependencies before creating again.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cannot load containers; draft retained.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (visible && targets === null && !loading) void loadTargets(); }, [visible]);
  // After the board changes outside the app, an untouched form follows the latest folders. Once the user has
  // entered anything, the loaded snapshot stays put (stale creation is rejected) and the change is flagged.
  useEffect(() => {
    if (!visible || targets === null || loading) return;
    const current = epoch.current;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/creation-targets');
        if (!response.ok) return;
        const latest = z.array(creationTargetSchema).parse(await response.json());
        if (cancelled || current !== epoch.current) return;
        if (!isDirty) {
          setTargets(latest);
          const chosen = getValues('target');
          if (chosen && !latest.some((target) => targetKey(target) === chosen)) {
            setValue('target', ''); setValue('dependencies', []);
          }
          setOutdated(false);
        } else {
          const same = latest.find((target) => selected && targetKey(target) === targetKey(selected));
          setOutdated(!!selected && same?.revision !== selected.revision);
        }
      } catch { /* The explicit reload action reports failures. */ }
    })();
    return () => { cancelled = true; };
  }, [issues, visible]);
  useEffect(() => {
    if (!isDirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [isDirty]);
  async function submit(value: Values) {
    if (!selected) { setMessage('Choose an available container with a recognized workflow. Your draft is retained.'); return; }
    const request = issueCreateSchema.safeParse({ container: selected.container, workflow: selected.workflow, expectedRevision: selected.revision,
      title: value.title, status: value.status, body: value.body, dependencies: value.dependencies,
      ...(selected.workflow === 'wayfinding' ? { type: value.type } : {}) });
    if (!request.success) { setMessage(request.error.issues.map((issue) => issue.message).join('; ')); return; }
    try {
      await onCreate(request.data);
      epoch.current += 1; setOutdated(false);
      reset(defaults); setTargets(null); setMessage(null); setPreview(false); onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Creation failed. Your draft is retained.'); }
  }
  return <section hidden={!visible} className="issue-creator" aria-label="Create issue" aria-busy={visible && loading}>
    {visible && <>
      <h2>Create issue</h2>
      <p className="muted">Create in an existing folder with a recognized workflow. Drafts stay in this tab when you close this form.</p>
      <button disabled={saving || loading} onClick={onClose}>Close creation</button>
      {message && <p role="alert">{message}</p>}
      {outdated && <p role="alert">The selected folder changed outside the app. Your draft is kept, but creating from the old snapshot will be rejected. Use Reload containers, keep draft to review the latest issues and dependencies first.</p>}
      {targets?.length === 0 && <p>No existing issue containers have a recognized workflow. Add a compatible numbered Markdown issue in your existing folder, then reload containers.</p>}
      <form noValidate onSubmit={handleSubmit(submit)}>
        <fieldset disabled={saving || loading}>
          <label>Feature / effort and workflow<select aria-label="New issue container" {...register('target')} onChange={(event) => {
            setValue('target', event.target.value); setValue('dependencies', []);
            const target = targets?.find((target) => targetKey(target) === event.target.value);
            setValue('status', target?.workflow === 'wayfinding' ? 'open' : 'needs-triage');
          }}>
            <option value="">Choose an existing container</option>
            {targets?.map((target) => <option key={targetKey(target)} value={targetKey(target)}>{target.feature} · {target.container} · {target.workflow}</option>)}
          </select></label>
          <label>Title<input aria-label="New issue title" {...register('title')} /></label>
          <label>Initial status<select aria-label="New issue status" {...register('status')}>
            {(selected?.workflow === 'wayfinding' ? wayfindingStatuses : implementationStatuses).map((status) => <option key={status}>{status}</option>)}
          </select></label>
          {selected?.workflow === 'wayfinding' && <label>Type<select aria-label="New issue type" {...register('type')}>
            {wayfindingType.options.map((type) => <option key={type}>{type}</option>)}
          </select></label>}
          <Controller name="dependencies" control={control} render={({ field }) => <label>Dependencies in this feature / effort
            <select multiple aria-label="New issue dependencies" ref={field.ref} onBlur={field.onBlur} value={field.value} onChange={(event) => field.onChange([...event.currentTarget.selectedOptions].map((option) => option.value))}>
              {candidates.map((issue) => <option key={issue.id} value={issue.id}>#{issue.number}: {issue.title} · {issue.container}</option>)}
            </select>
          </label>} />
          <p className="muted">Use Ctrl / Command to select multiple dependencies. Numbers are allocated safely when you create.</p>
          <label>Markdown body<textarea rows={12} aria-label="New issue body" {...register('body')} /></label>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Hide new issue preview' : 'Preview new issue'}</button>
          {preview && <div className="markdown" aria-label="New issue preview"><SafeMarkdown>{values.body}</SafeMarkdown></div>}
          <button type="submit" disabled={!selected}>Create issue</button>
        </fieldset>
      </form>
      <button disabled={saving || loading} onClick={() => { void loadTargets(true); }}>Reload containers, keep draft</button>
      <button disabled={saving || loading} onClick={() => { reset({ ...defaults, target: values.target, status: selected?.workflow === 'wayfinding' ? 'open' : 'needs-triage' }); setMessage(null); }}>Discard creation draft</button>
    </>}
  </section>;
}

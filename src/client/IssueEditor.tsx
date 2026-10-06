import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { issueChangesSchema, titleSchema, commentSchema, implementationStatuses, wayfindingStatuses, type Issue, type IssueChanges } from '../server/board.js';
import { issueDocument } from '../server/document.js';
import { resolveDependencies } from '../server/dependencies.js';
import { SafeMarkdown } from './SafeMarkdown';

type EditorValues = { title: string; status: string; dependencies: string[]; dependenciesEdited: boolean; body: string; comment: string };
export type IssueDraft = { base: Issue; original: EditorValues; values: EditorValues };
export type IssueEditorActions = {
  draft: IssueDraft | undefined;
  onDraft: (draft: IssueDraft | undefined) => void;
  onWrite: (base: Issue, endpoint: 'edit' | 'comment', fields: { changes: IssueChanges } | { comment: string }) => Promise<Issue>;
  onReload: () => Promise<void>;
};

export function editorValues(issue: Issue, issues: Issue[]): EditorValues {
  return { title: issue.title, status: issue.status ?? '',
    dependencies: [...new Set(resolveDependencies(issue, issues).flatMap((dependency) => dependency.kind === 'linked' ? [dependency.target.id] : []))],
    dependenciesEdited: false, body: issueDocument(issue.content!).body.replace(/\r\n/g, '\n'), comment: '' };
}

function changesFrom(values: EditorValues, base: EditorValues) {
  return {
    ...(values.title !== base.title ? { title: values.title } : {}),
    ...(values.status !== base.status ? { status: values.status } : {}),
    ...(values.dependenciesEdited || JSON.stringify([...values.dependencies].sort()) !== JSON.stringify([...base.dependencies].sort()) ? { dependencies: values.dependencies } : {}),
    ...(values.body !== base.body ? { body: values.body } : {}),
  };
}

export function IssueEditor(props: IssueEditorActions & { issue: Issue; issues: Issue[]; saving: boolean }) {
  let problem: string | undefined;
  try { if (!props.issue.workflow) throw new Error('This issue needs attention. Structured editing is unavailable.'); issueDocument(props.issue.content!); }
  catch (error) { problem = error instanceof Error ? error.message : 'Cannot safely edit this document.'; }
  if (problem) return <section aria-label="Issue editor"><p role="alert">{problem}</p>
    {props.draft && <><p>Your unsaved draft is retained. Copy it before editing the file directly.</p>
      <textarea aria-label="Recoverable draft" readOnly value={JSON.stringify(props.draft.values, null, 2)} />
      <button onClick={() => props.onDraft(undefined)}>Discard draft</button></>}
    <button disabled={props.saving} onClick={() => { void props.onReload().catch(() => {}); }}>Reload issues, keep draft</button>
  </section>;
  return <EditableIssue {...props} />;
}

function EditableIssue({ issue, issues, draft, onDraft, onWrite, onReload, saving }: IssueEditorActions & { issue: Issue; issues: Issue[]; saving: boolean }) {
  const base = draft?.base ?? issue;
  const defaults = draft?.original ?? editorValues(base, issues);
  const { register, control, getValues, setValue, watch, reset, handleSubmit, formState: { errors } } = useForm<EditorValues>({ defaultValues: draft?.values ?? defaults });
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const values = watch();
  // The form stays mounted across external changes so typing is never interrupted. Without a draft there is
  // nothing to protect, so it follows the file; with a draft, the stale banner offers review and recovery.
  const defaultsKey = JSON.stringify(defaults);
  useEffect(() => { if (!draft) reset(editorValues(issue, issues)); }, [issue.revision, defaultsKey]);
  const changed = Object.keys(changesFrom(values, defaults)).length > 0;
  const stale = base.revision !== issue.revision;
  const dependencies = resolveDependencies(base, issues);
  const candidates = issues.filter((candidate) => candidate.id !== issue.id && candidate.feature === issue.feature && candidate.location === issue.location &&
    candidate.number && resolveDependencies({ ...issue, dependencyText: candidate.number }, issues)[0]?.kind === 'linked');
  function retain() {
    const values = getValues();
    onDraft(!stale && !values.comment && !Object.keys(changesFrom(values, defaults)).length ? undefined : { base, original: defaults, values });
  }
  function replace(nextBase: Issue, nextValues: EditorValues) {
    reset(nextValues);
    const clean = !nextValues.comment && Object.keys(changesFrom(nextValues, editorValues(nextBase, issues))).length === 0;
    onDraft(clean ? undefined : { base: nextBase, original: editorValues(nextBase, issues), values: nextValues });
  }
  async function save(values: EditorValues) {
    const parsed = issueChangesSchema.safeParse(changesFrom(values, defaults));
    if (!parsed.success) { setMessage(parsed.error.issues.map((failure) => failure.message).join('; ')); return; }
    setMessage(null);
    try {
      const saved = await onWrite(base, 'edit', { changes: parsed.data });
      replace(saved, { ...editorValues(saved, issues), comment: values.comment });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Issue was not saved. Your draft is retained.'); }
  }
  async function append() {
    const comment = getValues('comment');
    const parsed = commentSchema.safeParse(comment);
    if (!parsed.success) { setMessage(parsed.error.issues.map((failure) => failure.message).join('; ')); return; }
    setMessage(null);
    try {
      const saved = await onWrite(base, 'comment', { comment });
      replace(saved, { ...getValues(), comment: '' });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Comment was not saved. Your draft is retained.'); }
  }
  return <section className="issue-editor" aria-label="Issue editor">
    <h3>Edit issue</h3>
    <p className="muted">Save fields and body explicitly. Existing comments are separate. Drafts stay in this tab when you switch issues.</p>
    {stale && <p role="alert">The loaded issue differs from your draft. Review the latest Markdown below before recovering changes.</p>}
    {message && <p role="alert">{message}</p>}
    <form noValidate onSubmit={handleSubmit(save)} onChange={retain}>
      <fieldset disabled={saving}>
        <label>Title<input aria-label="Issue title" {...register('title', { validate: (value) => titleSchema.safeParse(value).success || 'Enter a nonempty, single-line title (up to 500 characters) without surrounding whitespace.' })} aria-invalid={!!errors.title} /></label>
        {errors.title && <p role="alert">{errors.title.message}</p>}
        <label>Status<select aria-label="Issue status" {...register('status')}>
          {(issue.workflow === 'implementation' ? implementationStatuses : wayfindingStatuses).map((status) => <option key={status}>{status}</option>)}
        </select></label>
        <Controller name="dependencies" control={control} render={({ field }) => <label>Dependencies in this feature / effort
          <select multiple aria-label="Issue dependencies" value={field.value} onBlur={field.onBlur} ref={field.ref} onChange={(event) => {
            field.onChange([...event.currentTarget.selectedOptions].map((option) => option.value)); setValue('dependenciesEdited', true); retain();
          }}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>#{candidate.number}: {candidate.title} · {candidate.container}</option>)}</select>
        </label>} />
        <button type="button" onClick={() => { setValue('dependencies', []); setValue('dependenciesEdited', true); retain(); }}>Clear dependencies</button>
        <p className="muted">Use Ctrl / Command to select multiple dependencies or clear a selection. Original text: {base.dependencyText ?? 'No dependency metadata'}.
          {dependencies.some((dependency) => dependency.kind !== 'linked') && ' Unresolved references are retained unless you change the selection.'}</p>
        <label>Markdown body<textarea rows={14} aria-label="Markdown body" {...register('body')} /></label>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview body'}</button>
        {preview && <div className="markdown" aria-label="Body preview"><SafeMarkdown>{values.body}</SafeMarkdown></div>}
        <button type="submit" disabled={!changed}>Save issue</button>
        <label>New comment<textarea rows={4} aria-label="New comment" {...register('comment')} /></label>
        <button type="button" onClick={() => { void append(); }}>Append comment</button>
      </fieldset>
    </form>
    <div className="draft-actions">
      <button disabled={saving} onClick={() => { void onReload().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Reload failed; draft retained.')); }}>Reload issues, keep draft</button>
      {stale && <button disabled={saving} onClick={() => {
        const changes = changesFrom(getValues(), defaults);
        replace(issue, { ...editorValues(issue, issues), ...changes, dependenciesEdited: changes.dependencies !== undefined, comment: getValues('comment') });
        setMessage('Draft changes recovered onto the loaded version. Review all fields and Markdown before saving. For comments, check whether a lost response already saved the comment.');
      }}>Recover draft on latest version</button>}
      {(changed || values.comment || draft) && <button disabled={saving} onClick={() => { replace(issue, editorValues(issue, issues)); setMessage(null); }}>Discard draft</button>}
    </div>
  </section>;
}

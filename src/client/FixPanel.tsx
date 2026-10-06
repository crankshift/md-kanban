import { Button, Stack, Text, Box } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { implementationStatuses, wayfindingStatuses, wayfindingType, repairChangesSchema, type Issue, type Repair } from '../server/board.js';
import { Picker, choices } from './Picker';
import { MarkdownEditor } from './MarkdownEditor';

export type RepairFields = Omit<Extract<Repair, { changes: unknown }>, 'path' | 'expectedRevision'> | { content: string };
export type RepairActions = {
  onRepair: (base: Issue, fields: RepairFields) => Promise<Issue>;
  onDirty: (dirty: boolean) => void;
};
const statusChoices = [
  ...implementationStatuses.map((value) => ({ value, label: `${value} · Implementation` })),
  ...wayfindingStatuses.map((value) => ({ value, label: `${value} · Wayfinding` })),
];
export function FixPanel({ issue, saving, onRepair, onDirty }: RepairActions & { issue: Issue; saving: boolean }) {
  const [draft, setDraft] = useState<{ base: Issue; status: string; type: string; removeType: boolean } | null>(null);
  const [raw, setRaw] = useState<{ base: Issue; content: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = !!draft || !!raw && raw.content !== raw.base.content;
  useEffect(() => {
    onDirty(dirty);
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, onDirty]);
  function choose(changes: Partial<NonNullable<typeof draft>>) {
    setDraft((current) => ({ base: issue, status: '', type: '', removeType: false, ...current, ...changes }));
    onDirty(true);
  }
  async function save(base: Issue, fields: RepairFields) {
    setMessage(null);
    try {
      await onRepair(base, fields);
      setDraft(null); setRaw(null); onDirty(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Fix was not saved. Your changes are kept.'); }
  }
  function closeRaw() {
    if (raw && raw.content !== raw.base.content && !window.confirm('Discard unsaved Markdown changes?')) return;
    setRaw(null); onDirty(!!draft);
  }
  if (!issue.diagnostics.length && !draft && !raw) return null;
  const base = raw?.base ?? draft?.base;
  return <Stack gap="4" aria-label="Fix issue">
    <Text fontWeight="semibold">Choose fixes for this file</Text>
    <Text fontSize="sm">Only chosen metadata lines change. Apply fixes or save Markdown to write the file.</Text>
    {message && <Text role="alert">{message}</Text>}
    {base && base.revision !== issue.revision && <Text role="alert">The file changed on disk. Your draft is kept; saving this version will be rejected. Copy your changes, then reset and review the latest file.</Text>}
    {issue.diagnostics.map((reason) => {
      const status = /^(Missing status|Unknown status|Workflow cannot)/.test(reason);
      const ambiguous = reason.startsWith('Ambiguous workflow');
      const type = reason.startsWith('Unknown wayfinding type');
      return <Box key={reason} borderWidth="1px" rounded="l2" p="3">
        <Text mb="2">{ambiguous ? 'This implementation status has a Type line for wayfinding. Remove Type or choose a wayfinding status.' : status ? `The file needs a supported status. ${reason}` : type ? `Choose a supported wayfinding type. ${reason}` : reason}</Text>
        {(status && !reason.startsWith('Workflow cannot') || ambiguous) && <Picker label="Set status" items={statusChoices} value={draft?.status ? [draft.status] : []} disabled={saving || !!raw || issue.content === null} onChange={(values) => choose({ status: values[0] ?? '' })} />}
        {type && <Picker label="Set type" items={choices(wayfindingType.options)} value={draft?.type ? [draft.type] : []} disabled={saving || !!raw || issue.content === null || !!draft?.removeType} onChange={(values) => choose({ type: values[0] ?? '' })} />}
        {ambiguous && <label><input type="checkbox" checked={draft?.removeType ?? false} disabled={saving || !!raw || issue.content === null} onChange={(event) => choose({ removeType: event.target.checked })} /> Remove Type line</label>}
        {!status && !type && !ambiguous && <Text fontSize="sm">Fix this problem in the Markdown editor.</Text>}
      </Box>;
    })}
    {draft && <>
      <Button disabled={saving || !!raw || !(draft.status || draft.type || draft.removeType)} onClick={() => {
        const changes = { ...(draft.status ? { status: draft.status } : {}),
          ...(draft.removeType ? { type: null } : draft.type ? { type: draft.type } : {}) };
        void save(draft.base, { changes: repairChangesSchema.parse(changes) });
      }}>Apply fixes</Button>
      <Button disabled={saving} onClick={() => { setDraft(null); onDirty(!!raw && raw.content !== raw.base.content); }}>Reset fixes</Button>
    </>}
    {raw ? <>
      <MarkdownEditor body={raw.content} previewLabel="File preview"><textarea aria-label="File Markdown" disabled={saving} value={raw.content} onChange={(event) => { setRaw({ ...raw, content: event.target.value }); onDirty(event.target.value !== raw.base.content || !!draft); }} /></MarkdownEditor>
      <Button disabled={saving || raw.content === raw.base.content || issue.content === null} onClick={() => void save(raw.base, { content: raw.content })}>Save file</Button>
      <Button disabled={saving} onClick={closeRaw}>Cancel Markdown editing</Button>
    </> : <Button disabled={saving || issue.content === null} onClick={() => setRaw({ base: issue, content: issue.content! })}>Edit Markdown</Button>}
    {issue.content === null && <Text role="alert">The file cannot be read. Check its permissions or encoding, then reload issues.</Text>}
  </Stack>;
}

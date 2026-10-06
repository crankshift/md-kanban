# 10: Move client state into the URL, query cache, and editor

Status: ready-for-agent
Blocked by: 08

## Outcome

The board keeps its current look, but its state follows ADR 0005: views are restorable from the URL, file data and writes go through one query cache with optimistic updates, and drafts live only in their open editor. The later Chakra rebuild then only replaces the view layer.

## Scope

- Add React Router, nuqs, and TanStack Query. Do not add app-owned React Context or a global store; library providers are the only context.
- Keep the workflow, search text, location, feature or effort, open issue, open document, and create form in URL search params. Browser Back closes the open issue or document, or returns from a followed link. Serve the client for non-API paths so deep links resolve.
- Read the board, supporting documents, opened documents, creation targets, and session context through queries. Live file-change events invalidate them; refetches wait while a write is in flight so a late response never shows an unsaved state. This replaces the hand-written request counters and refresh queue in `Board.tsx`.
- Make every write a mutation with an optimistic update and rollback: status moves, editor saves, comments, and issue creation. A created issue appears without a number, marked as being created, until the server confirms its number. Keep stale-write rejection for every write.
- Replace retained multi-issue drafts with editor-only drafts: unsaved changes exist only while that issue's editor is open, and closing it asks for confirmation. Remove the draft list. An external change to the open issue keeps the draft and shows which fields changed on disk and in the draft, with "Discard mine" and "Reapply mine on latest"; fields changed on both sides need an extra confirmation. A save that fails after the editor closed offers to reopen the editor with the submitted values.
- Move client-only packages to `devDependencies`; runtime `dependencies` are only what the server needs (`zod`, `open`).
- Add `CHANGELOG.md` in Keep a Changelog 1.1 format with an `Unreleased` section summarizing tickets 01–08 and this ticket. Document in `CONTRIBUTING.md` and `docs/agents/issue-tracker.md` that every ticket updates `Unreleased` in its own commit.
- Leave the visual design and the prototype under `src/client/prototype/` untouched.

## Acceptance criteria

- Reloading or sharing a URL restores the workflow, filters, and the open issue or document; browser Back closes or returns as described.
- Status moves, saves, comments, and creation appear immediately and roll back with a visible error when the write fails or is stale; a failed status move never stays shown as saved.
- A created issue shows no number until the write is confirmed.
- External changes refresh untouched issues without disturbing an open editor; a conflicting draft offers both recovery choices and never overwrites silently.
- No app-owned `createContext` or global store exists in `src/client` outside the prototype.
- The packed package installs only `zod` and `open` as runtime dependencies and still launches.
- `CHANGELOG.md` exists and the contribution docs describe the update rule.
- Existing behavior tests are updated for the new draft model and pass, along with type checking and the production build.

## Comments

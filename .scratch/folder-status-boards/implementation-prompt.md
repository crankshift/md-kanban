Implement the approved folder-scoped Markdown workspace in `/Users/crankshift/khmara/projects/md-kanban-board` using **A: classic compact cards with a side reader**, including the cursor-following drag shadow.

This is the production implementation handoff. The user completed the brainstorm, reviewed the project-based prototype, approved A after the drag-shadow refinement, and confirmed “we go with A”. Deliver the complete accepted behavior end to end with real filesystem writes, appropriate checks, and a working local production preview. Resolve routine technical choices from the approved answers and current code.

## Start from production and read the design

Inspect the working tree and current branch first. Use one feature branch, `feat/folder-status-boards`, from current production `main`; reuse it if it already contains this effort. Preserve existing work, including the approved planning files, glossary changes, and ADRs currently in the working tree. Keep focused implementation commits on that branch. Pushing, merging, publication, deployment, and version changes are separate work.

Read `AGENTS.md`, its referenced agent docs, `GLOSSARY.md`, and ADRs 0001, 0003, 0004, 0005, 0008, 0009, and 0010 before changing code. The canonical design is `.scratch/folder-status-boards/map.md` and the resolved `## Answer` sections of its six child decisions. Their historical Comments include superseded proposals; the final answers and final prototype approval control. ADR 0010 extends the earlier status-only boundary: explicit Edit and Add comment are available to ordinary documents too.

The approved primary source is commit `4ce592d` on `prototype/folder-status-boards-2026-10-08`. Inspect it with `git show` without switching away from the implementation branch:

- `src/client/workspace/folder-status-prototype/PrototypeApp.tsx`: VariantA, project shell, dialogs, and prototype wiring.
- `src/client/workspace/folder-status-prototype/StatusBoard.tsx`: compact cards, status columns, pointer/keyboard interaction, and the floating drag card.
- `src/client/workspace/folder-status-prototype/model.ts` and `README.md`: demonstrated metadata behavior, scope, and limitations.
- The same capture's `FolderTree.tsx` and `WorkspaceReader.tsx`: eye controls and generic document actions in their project context.

Use the prototype as behavioral and visual evidence. Implement clean production modules from current main. Keep its archive intact; its in-memory document copies, global fetch interception, read-only preview server, development gates, comparison layouts, floating variant switcher, diagnostic state inspector, and synthetic failure controls belong only to the prototype. The earlier standalone HTML capture is superseded.

Track execution separately from the resolved wayfinding decisions, using the repo's local implementation-ticket conventions. Carry the approved design documentation into the feature branch and update Unreleased CHANGELOG with each implemented ticket.

## Discover documents and control folder scope

- Discover `.md` and `.markdown` recursively throughout the launch folder, including files at its root and arbitrary nested folders. Repository launches and directly selected folders obey the same boundary. Folder names, numbering, status values, and issue containers do not determine document membership.
- A selected folder includes its descendants. Start with the launch folder; selecting `tickets/` includes `tickets/archive/` and excludes sibling `notes/` documents from that scope.
- Provide hide/show eye controls. Hiding a folder hides its subtree from Files, Board, Map, and status discovery. If the selected scope is hidden, move it to the nearest visible ancestor. An already open document can remain readable.
- Default-hide `node_modules`, `vendor`, `.pnpm-store`, `dist`, `build`, `coverage`, `.cache`, and `.next`, with on-demand reveal. Ordinary folders, including `.scratch`, `.agents`, and `.codex`, start visible. `.git` remains excluded. Keep hidden-folder rows revealable and empty folders selectable without parsing all dependency Markdown at startup.
- Hidden documents remain readable through explicit in-boundary links; reading one does not reveal the folder or add a map node. Separate visibility from permanent filesystem protections and write authorization. Apply visibility consistently to indexing, query/cache identities, relationships, and live refresh rather than mutating a global access-denial set as the prototype does.
- Put visibility and navigation in URL state so reload and Back restore the view. Fresh launch URLs use defaults. Automatic cross-launch or cross-port preference memory is deferred.

## Build the authored-status board and real dragging

- Use A's project layout and earlier compact card styling: condensed medium-weight titles, quiet metadata, simple bordered cards, muted column wells, and a side reader. Preserve the existing theme, light/dark modes, responsive navigation, Files, and Map capabilities.
- Discover status columns from visible documents across the entire selected folder scope before search and property/value filters. Filters affect cards while destinations stay available; sibling scopes contribute no statuses.
- Status labels differing only by letter case share a column. Preserve existing file spelling until an explicit change. A move writes the destination column's displayed spelling; a same-status drop, including case-only variants, writes nothing.
- Missing or blank status belongs to the system **No status** group. Conflicting or non-text status belongs to **Check status**. Duplicate status occurrences, including equal values, disable structured status moves until corrected. Keep every document readable with a specific explanation. Use stable identities so authored labels such as `No status` and `Check status` remain distinct from system groups.
- A scope with no statuses starts with No status and no invented presets. **Add status** accepts an authored label and creates an empty destination without a dummy issue. Keep introduced/emptied columns until page reload unless a file uses the value; rediscover from files after reload. Switching filters, views, or scope must not accidentally erase session destinations or retain statuses contributed only by hidden files.
- Drag cards between status columns. Retain activation behavior that distinguishes opening a card from dragging it, mouse/touch support, keyboard pickup/arrows/drop/Escape, announcements, focus recovery, and an accessible non-drag status control. Card ordering and column reordering are outside this feature.
- During pointer dragging, lift a same-size card preview that follows the original grab point with a shadow. Fade the original in place, use a grabbing cursor, highlight the destination, and render the preview outside scrolling/clipping containers with pointer events disabled. Drop, Escape, outside drop, pointer cancellation, and lost capture must remove it and restore the cursor without accidental reading or writes.
- Capture the original document identity/content revision at pickup. Move optimistically through the shared write boundary; reject stale moves, roll back failures, and preserve an external author's latest content. Disable conflicting/pending moves and unconfirmed creation placeholders. Cancellation and own-column/outside drops are no-ops.

## Generalize document tools and creation

Make optional explicit **Edit** and **Add comment** available to every readable in-boundary Markdown document. Reading stays the default. A note and an issue need no filename, status vocabulary, Type marker, or workflow classification to use these actions.

Remove fixed implementation/wayfinding status enums and classification gates from the app's validation, write authorization, creator, editor, status controls, and repair behavior. Existing authored labels and the repo's agent-tracker conventions remain author-defined data. An unfamiliar status is not an error, and no label automatically establishes completion or dependency resolution. Keep meaningful malformed/duplicate/conflicting metadata diagnostics and explicit dependency targets.

Structured status changes must update the existing YAML frontmatter scalar or leading plain/bold Status property without regenerating the file. Preserve unrelated fields, comments, sections, checkboxes, whitespace, quoting, and line endings. Insert a missing status into existing frontmatter, or beneath the title in a leading property block otherwise. Dropping into No status removes only that property. Full-source editing permits deliberate metadata correction; structured controls must not guess which ambiguous occurrence to change. Comments append through the existing section-preserving contract, creating a Comments section when necessary.

**New issue** works in any chosen in-boundary folder, including an empty folder, and defaults to the current scope. Suggest an editable title-based filename; continue an unambiguous existing numbering pattern without requiring numbering. Never overwrite an existing file. Status is optional, with target-folder suggestions and free text; it starts at No status unless launched from a status column, whose label is prefilled and remains editable/clearable. Generate a title, optional body, and optional Status, without automatic Type, workflow, or Blocked by fields.

**New folder** is available in the folder tree and New issue's folder picker. It creates a real directory immediately under the chosen parent, appears even when empty, and remains if issue creation is cancelled. Apply the same root, path, symlink, session, and origin protections to folder creation as to document authoring.

## Preserve production contracts

Reuse and extend the authenticated filesystem write boundary rather than the prototype simulator. Preserve safe relative paths, selected-root containment, symlink/regular-file checks, UTF-8 and preview-size constraints, expected revisions, locks, temporary sibling files, atomic publication, and existing conflict/lost-response recovery. Refactor writable document identity so it does not depend on legacy issue discovery or a recognized workflow. Every write remains an explicit user action; preserve drafts on external refresh and failed saves, confirm discarding dirty drafts, and avoid automatic retries that duplicate comments or creation.

Keep navigation/search/filter/open-document/dialog state in the URL, disk data and writes in TanStack Query, and drafts in their editor forms, following ADR 0005. Maintain live updates for creation, editing, renames, deletion, and atomic replacement, including revealed folders and explicitly opened hidden documents, without expanding collection membership or losing drafts. Keep the existing document maps, safe Markdown/link/fragment navigation, measured-node/hover stability, installed-package runtime behavior, and client chunk limits working.

For library-specific work, use current Context7 documentation through the CLI outside the sandbox as `AGENTS.md` requires. Respect the existing pnpm maturity policy and packaging boundaries; add only necessary dependencies. The prototype's hand-written pointer code and simplified write simulation are not production-ready contracts.

## Verify and deliver

Use meaningful portable disk/API/UI integration coverage for the new behavior, updating tests tied to deliberately removed workflow restrictions. Exercise root/direct-folder discovery, arbitrary/empty/revealed folders, hidden links, scope-local statuses, case variants, special-label collisions, missing/blank/ambiguous metadata, exact Markdown preservation, stale/failed writes, arbitrary-status issue creation, folder creation/cancellation, generic edits/comments, live refresh, and draft recovery. Preserve session/origin/path/symlink boundary coverage.

Run the repo's required typecheck, build, relevant tests, final full checks, and packed-package verification. Preserve the existing emitted-JavaScript chunk budget instead of raising the warning threshold. In a real browser using disposable fixtures, verify A in light/dark and narrow layouts, actual mouse dragging with a moving shadow, keyboard movement/cancellation/focus, readable metadata diagnostics, source preservation, custom statuses, new folders/issues, ordinary-document tools, and Files/Map/link navigation. Do not weaken production origin/access checks to accommodate automation. Record physical-touch verification limits honestly.

Completion means the entire agreed feature works in the production app with real writes and passing required checks. Update user/contributor docs, glossary/ADRs where necessary, Unreleased CHANGELOG, and implementation-ticket results; preserve the resolved design and prototype capture. Leave a working local production preview, commit the completed feature on the implementation branch, and report branch/commits, validation, preview URL, and concrete limitations. Stop before release or publication work.

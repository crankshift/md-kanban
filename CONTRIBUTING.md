# Contributing to mdboard

Start with the [generic workspace specification](.scratch/markdown-library/spec.md), [implementation issue 02](.scratch/markdown-library/issues/02-implement-variant-a.md), [glossary](GLOSSARY.md), and [architectural decisions](docs/adr/). ADR 0008 makes documents and folder scopes the product model. Existing issue write contracts remain optional adapters. The selected A reference is archived at `477054d` on `prototype/markdown-workspace-2026-10-07`; inspect it with `git show`, never use it as an implementation base or ship its preview server.

## Setup and checks

Use Node 22.22 or newer and pnpm 11.21.0 (the version pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

`pnpm check` runs type checking, the production build, and the full test suite. Tests launch real loopback servers and install a tarball into temporary directories. Test files run sequentially because the packed-package check rebuilds shared `dist` assets; concurrent server tests could otherwise observe the build directory being replaced. The packed-package test uses the pnpm store offline after `pnpm install`; it requires permission to bind local ports. Parser/discovery/dependency checks use portable temporary Markdown fixtures. UI checks render both workflows and attention diagnostics through React, and exercise search/filter, details/dependency, keyboard status changes, and navigator/dialog keyboard interaction with React `act` and jsdom. Creation, status and React Hook Form interactions use the real HTTP API and disk, including explicit field/body saves, safe previews, scoped dependencies, comment append, navigation confirmation, stale recovery, and lost comment responses; network-failure checks replace only the fetch transport. API checks cover preserved Markdown bytes, permissions, revisions, external edits, simultaneous writes within and across processes, session/origin/path restrictions, and recoverable failures. Creation checks cover convention matching, scope allocation, occupied numbers, overlapping launches, stale container snapshots, validation, disk failures, draft preservation, and lost-response retries. Refresh checks use real file watching: they write, create, rename, delete, and atomically replace issue files and assert the event stream, the polling fallback, shutdown (including the CLI with an open stream and released native watchers), and the React board against a real server through a fetch-based `EventSource` (`tests/render-board.mjs`), including drafts, filters, conflicts, removals, malformed files, in-flight saves, and creation snapshots. `tests/events.mjs` is a small stream client for API-level checks. No private issue fixtures are needed. After changing server/shared modules, rebuild before running individual test files because they import `dist/server`.

## Local development

```sh
pnpm dev --no-open ./
```

This builds both TypeScript server code and the Vite frontend, then launches the real CLI. It does not rebuild on source changes (the app's file watching is for selected Markdown data); after source changes, stop with Ctrl+C and rerun. For an existing build:

```sh
pnpm start --no-open ./
```

For caller-cwd behavior, run `node /path/to/checkout/dist/server/cli.js --no-open` from another directory. Replace the example path with your checkout. Frontend assets are resolved beside the installed server, never from the selected folder.

## Packed-package verification

This POSIX shell recipe builds and installs the local package without publishing:

```sh
verification_dir=$(mktemp -d)
pnpm pack --out "$verification_dir/mdboard.tgz"
mkdir "$verification_dir/installation" "$verification_dir/issues"
cd "$verification_dir/installation"
printf '{"private":true}\n' > package.json
pnpm add --offline --ignore-scripts "$verification_dir/mdboard.tgz"
./node_modules/.bin/mdboard --no-open "$verification_dir/issues"
```

Open the printed URL and confirm the folder explorer, empty collection, Files/Board/Map controls, light/dark modes, and responsive Folder scope picker. Create ordinary `.md` and `.markdown` files in the temporary folder with arbitrary leading properties and YAML frontmatter; verify recursive discovery, path/title/body search, duplicates/conflicts, empty values, and an author's literal `No value`. Group by a property and physical folder. Follow relative/reference links and fragments; inspect backlinks and browser Back. Test Overview, Directed, Folders, and local one-hop maps, including isolated files and a selected dependency property with explicit file paths. Numeric dependency references must not become graph edges.

For the hover regression, use exactly `A.md → B.md` and `C.md → B.md`. Select A, leave the pointer on C at its center and borders, and refresh through both a file edit and explicit reload. C must remain visible and stationary, selection must remain A, and the C/B focus stroke must stay stable. Test All connections and keyboard node activation. Repeat in light/dark modes and each global layout. Local maps must keep incoming/outgoing/two-way branches separate and omit neighbor-to-neighbor chains.

Add `01-example.md` with `# 01: Example` and `Status: ready-for-agent` on separate lines. Read it, open **Issue tools**, change status, save an explicit title/body edit, preview Markdown, and append a comment. Inspect bytes on disk. Change the file externally while a draft is open; verify stale-save rejection, draft retention, reload/reapply/discard, Back and close guards, removed-file recovery, and lost-response recovery. Use **New issue** with an existing supported container and inspect the allocated file. Generic files must have no editor or status-write controls. Ctrl+C must exit promptly with an event stream open.

Keep fixtures and screenshots outside the checkout. `pnpm pack` typechecks and rebuilds automatically; the package allowlist contains compiled assets and public documentation only.

Before removing the directory, you can also run the tarball the way the registry commands will run the published package. Use it from any folder outside the checkout:

```sh
npx --yes --package "$verification_dir/mdboard.tgz" mdboard --no-open ./
pnpm dlx --package "$verification_dir/mdboard.tgz" mdboard --no-open ./
```

### Release-candidate checks

Run `pnpm check` after the final changes and verify the installed tarball outside the checkout. `tests/package.test.mjs` checks bundled assets, server parsers, local origin/session checks, issue writes/creation, live events, and shutdown. Keep the current release version; publication is a separate task.

The tarball must contain no prototype server, losing variants, state inspector, development gates, fixtures, private paths, source maps, or tests. React Flow, D3-Force, Dagre, Chakra, and React ship as browser build assets; `yaml`, `unified`, `remark-parse`, and `remark-gfm` must be runtime dependencies because the installed server imports them.

## Document discovery and map boundary

`GET /api/documents` returns the recursively discovered documents, directed link/dependency candidates, directory warnings, and selected root. Paths are normalized relative identities. A repository marker (`.git`) or both conventional roots identifies a repository launch; selected document-tree folders always remain direct boundaries. Repository launches scan `docs/` and `.scratch/` plus supported top-level issue containers; direct folder launches scan only their own descendants. `.md` and `.markdown` matching is case insensitive. Dependency/repository internals and generated directories are excluded; ordinary archive, draft, guidance, and ADR folders are included. Symbolic Markdown files stay listed as unavailable; directory symlinks are never traversed. Directory access failures are reported. Safe reads check each path component, opened-file identity, and the 2 MiB cap.

`markdown-metadata.ts` reads optional YAML and a conservative leading plain/bold property block. It retains source/raw occurrences, bounds aliases, and reports malformed/duplicate/conflicting data. Failsafe YAML scalars retain literal values. It parses Markdown links through an AST so reference links resolve and code examples do not become relationships. Only explicit Markdown file targets produce dependency candidates; the URL's selected property determines which are shown. Numeric references remain metadata. Raw content is retained separately from the reader body without frontmatter.

`GET /api/document` reads allowed in-boundary linked files even outside the index. `GET /api/document-link` resolves relative Markdown paths and fragments with the same access restrictions. A linked-only target never silently expands discovery or creates a graph node. The safe renderer uses `react-markdown`/`remark-gfm`, `skipHtml`, and the library's URL sanitization. Do not enable raw HTML or disable sanitization.

`src/client/workspace/` owns A's folder explorer, file results, reader, generic Board, and map presentation. URL state owns navigation/filter/group/map settings, TanStack Query owns disk data, and existing editor forms own drafts (ADR 0005). Physical folder grouping and authored property names have separate identities; missing/empty/literal/conflicting values also remain distinct. The generic board has no drag or mutation handlers.

`map-layout.ts` computes static D3-Force Overview placement, Dagre Directed placement, folder groups, and independent local branches. `DocumentMap.tsx` keeps original directions while combining reciprocal display strokes and attaches straight edges to measured node boundaries. Its stable handlers retain React Flow's measured geometry through controlled updates; never rebuild nodes without those dimensions or mask the regression with hover delays. `workspace-ui.test.mjs` mounts the real canvas using a deterministic jsdom geometry adapter. Real-browser center/border checks remain necessary for pointer behavior and layout.

`GET /api/issues`, the existing issue parser, dependency resolver, and creation targets remain separate write-capability contracts. Their recognized numbering, containers, metadata diagnostics, and vocabularies never determine generic document membership. `Board.tsx` retains those optional write/draft operations; the production App mounts its tool dialogs alongside the generic workspace. Legacy board/drag tests still exercise the unchanged adapter independently, while production navigation tests use `App` and A's controls.

## Write boundary

`GET /api/context` returns the selected folder and a random `sessionToken` scoped to this server launch. `POST /api/status` requires JSON `{ path, expectedRevision, status }` and the `X-Mdboard-Session` header; Zod rejects missing/extra fields, invalid revisions/paths, and unsupported statuses. The host must exactly match the printed loopback URL. Supplied Origin and Fetch Metadata headers must describe an allowed local request; other origins, same-site requests from another port, DNS-rebinding hosts, and other app sessions are rejected. No CORS access is enabled, and framing is prohibited. Tokens stay in browser memory and are not placed in URLs or logs. Status request size is capped at 16 KiB; editor/comment requests are capped at 1 MiB, with body/comment fields limited to 500,000/100,000 characters. Non-browser clients may omit Origin/Fetch Metadata but still need the session token and correct host.

`src/server/writes.ts` provides `createIssueWriter(...).update(identity, transform)`, the shared boundary for all field/body/comment mutations. Reuse it with the loaded revision; do not add direct file writes for existing issues. New issues use the separate exclusive creation boundary described below. It accepts only discovered issues under the selected root, refuses symlinks, validates current metadata and UTF-8 bytes, and checks the file revision and opened-file identity. Status transitions must retain the recognized workflow; Needs attention documents stay unmodified. Writes to one path are queued within a process. An exclusive sibling lock protects cooperating mdboard processes, including servers launched against overlapping roots. A failed or stale save releases the queue and lock. If a process crashes, the lock remains intentionally: stop all mdboard processes and remove the reported `.mdboard-*.lock` beside the issue before restarting. Orphan `.mdboard-*.tmp` files can be removed while processes are stopped.

The writer applies a targeted transform, writes and syncs a temporary sibling file, preserves ordinary permission bits, rechecks the original revision/identity, then atomically renames the replacement. Normal failure leaves the original intact and cleans up temporary files. Atomic replacement changes the file inode; extended filesystem metadata such as ACLs/xattrs and hard-link relationships are not preserved. Revision checks reject external edits made since loading, but an external editor that ignores the lock can still race the final check and rename: portable Node APIs provide no atomic compare-and-replace against those writers. Likewise, the selected tree must remain in place during a save; path/symlink checks are not an OS-level sandbox against hostile concurrent directory replacement.

`DragBoard.tsx` uses the exactly pinned `@dnd-kit/react` and `@dnd-kit/dom` 0.5.0 hooks, configured pointer/keyboard sensors, and accessibility plugin. Mouse pickup requires 6 pixels of movement; touch requires a 200 ms hold with 8 pixels of tolerance. Enter opens details; Space picks up for keyboard dragging. Only columns are droppable; there is no sortable state or priority persistence. Pickup captures the issue snapshot before drag initialization, so an external refresh cannot substitute a newer revision into a drop. Drops reuse the existing status mutation; cancelled, same-column, and outside-column drops call no write. Whole-card dragging is disabled during any write or reload and on unconfirmed creation placeholders. Keyboard focus returns to the moved card after save/rollback. List cards open details without dragging; the detail status picker remains available. `tests/drag-board.test.mjs` exercises the real board/API/files with browser API adapters and deterministic adjacent-column geometry in jsdom; geometry, mouse, and touch should also be verified in a real browser.

Every write uses a TanStack Query mutation. Pending status moves, edits, comments, and creation update the cache optimistically; rollback restores the previous board on failure and shows an error. The server response supplies the confirmed issue and revision. Writes are serialized at the client entry point and controls pause during a save. Failed writes invalidate disk queries, retaining the previous data with an outdated-state warning if refresh fails.

`POST /api/edit` requires `{ path, expectedRevision, changes }`, where `changes` contains only changed `title`, `status`, `dependencies` (root-relative issue identities), and/or `body` fields. `POST /api/comment` requires `{ path, expectedRevision, comment }`. Both reuse the status API's session/origin checks and `writer.update`; every operation, including no-op requests, checks the expected revision. Invalid titles, wrong-workflow statuses, cross-effort/self/ambiguous dependency selections, and unsafe body/comment section boundaries reject without writing. Newly selected dependencies serialize as numbers; equivalent resolved selections retain their original text.

`src/server/document.ts` shares leading metadata offsets with the parser and separates the body from the first level-two Comments section outside fenced code. The body excludes its surrounding blank-line separators. Comments end at the next level-one/two section; appends preserve that suffix. Repeated Comments sections and unclosed fences have no guessed editor layout. Only requested ranges change; edited body/comment newlines adopt the original document's LF/CRLF convention. `edits.ts` combines structured/body patches, and the writer reparses the result before replacement. The parser takes the number/title from the first issue heading, so numbered headings inside body examples cannot redefine an unnumbered issue heading.

`IssueEditor.tsx` uses React Hook Form, runtime Zod validation, and `SafeMarkdown`. Its draft snapshot and form values stay local to the mounted editor. Navigation that would close the editor goes through React Router's blocker and asks to discard unsaved input; before-unload protection covers hard reloads. An external revision keeps the form and lists changed disk/draft fields. Discard mine resets to disk; Reapply mine on latest overlays changed fields, requiring extra confirmation for overlapping fields. Field saves retain unsent comments, and comment saves retain field edits with the returned revision. Removed/unsupported issues retain copyable values only in their open panel. Failed mutation variables retain submitted values and provide reopening after closure, including if another write occurs; successful recovery or explicit discard clears those failed snapshots. Drafts never use browser storage or the URL.

`GET /api/creation-targets` returns existing containers with recognized workflows and SHA-256 snapshot revisions. Each snapshot includes discovered issue revisions/diagnostics in the same feature/location, occupied directory names, and directory identities. An empty or entirely unsupported container cannot establish a workflow. `POST /api/create` requires `{ container, workflow, expectedRevision, title, status, body, dependencies, type? }`; `container` is root-relative or `.` for the selected issue folder. The endpoint shares session/origin checks, strict Zod validation, and the 1 MiB request limit. Dependencies are root-relative identities in the same discovered scope. Type is available only for wayfinding and defaults to `task`.

`src/server/creation.ts` authorizes discovered containers, refuses symlink paths, and acquires `.mdboard-create.lock` in each discovered container of the selected scope in sorted order. Cooperating processes and overlapping launch roots share these lock paths; locks stay inside the selected boundary. It checks the loaded container snapshot, allocates above every occupied/discovered number in that scope, and uses an existing valid issue in that container/workflow as the style reference (the first in board order). It preserves number width, filename separator, numbered/unnumbered heading style, heading separator, recognized metadata key style, and LF/CRLF convention; unsupported filename styles fall back to numbered Markdown with a safe title slug. Unicode titles remain in Markdown; filename slugs transliterate combining accents and restrict characters to ASCII letters, digits, and hyphens, falling back to `issue`. Unknown metadata and body from the reference issue are not copied. New body/dependency rendering reuses the editor's validated transforms and reparses before publication.

Creation writes and syncs a private temporary sibling, rechecks the snapshot, then hard-links it to the final filename. Hard-link publication is atomic and fails if any destination already exists; it never uses overwriting rename. Successful files are created with owner-only permissions (`0600`). Normal outcomes remove temporary files and locks. Interrupted creation can leave `.mdboard-create.lock` or `.mdboard-*.tmp`; stop all app processes before removing them. Filesystems that cannot create hard links report a recoverable failure. Scope is limited to discovered issues inside the launch root, including number/dependency allocation; a direct-folder launch does not inspect sibling containers outside that boundary. External editors do not take these locks and can race the final snapshot check or independently introduce duplicate numbers with different filenames. Publication still cannot overwrite their files. Hostile directory replacement has the same path-check limitations as the existing writer.

`IssueCreator.tsx` uses React Hook Form and reads creation targets through the query cache. The original target revision is a form snapshot: untouched forms follow refetches, dirty forms flag changes until an explicit reload. Confirming closure discards the form. Creation displays a placeholder without a number until confirmation, then opens the returned issue and clears filters. Failures remove the placeholder, preserve inputs while open, invalidate disk queries, and require review before retrying a possible lost-response creation.

## Refresh boundary

`src/server/watcher.ts` observes the selected folder with recursive `fs.watch`, debounces hints for 100 ms, and fingerprints the discovered board plus Markdown file and directory stat versions, including ADRs and ordinary linked documents. Symbolic file identities are fingerprinted without following them; ignored directories stay excluded; lock and temporary files do not notify. Changes publish only a version, never contents or draft data. Native watching falls back to one-second polling on failure or unreadable roots. Very large trees can reach OS watch limits and use that fallback. Document reads still enforce the separate document API boundary.

`GET /api/events` is a server-sent event stream with the same Host/Origin/Fetch Metadata checks as other requests; it needs no session token because it carries no data, only `ready` and `change` events with a version number. Clients invalidate every disk query after each event and again on every (re)connection, so a missed event is repaired. `startServer` returns `{ server, url, close }`. `close()` stops the watcher, ends every stream, closes the server, and may be called more than once; a plain `server.close()` also releases the watcher once the server closes, and the CLI uses `close()` for SIGINT/SIGTERM.

`ClientState.tsx` supplies library providers and query helpers. React Router and nuqs parse view state from the URL; all URL writes use router navigation so browser history and unsaved-editor blocking share the same boundary. File data (board, session context, document collection, opened document, creation targets) uses `disk` query keys. SSE connection/change and focus invalidate them. Mutations cancel in-flight reads before optimistic updates; disabled queries defer background reads while writes are pending, and query functions also wait on the mutation cache to protect explicit refetches. Invalidation on settlement is deliberately not awaited, because queries must wait until that mutation is no longer pending. TanStack Query owns cancellation, structural sharing, and refresh ordering; no request counters, refresh queue, app-owned React Context, or global store is used. An open issue's editor stays mounted across missing/malformed files and can recover when the file returns.

## Proposing changes

Open an issue at [crankshift/md-kanban](https://github.com/crankshift/md-kanban/issues) to discuss a bug, design change, or feature proposal. Every implementation ticket must update the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md) in its own focused commit, recording user-visible changes. Internal specifications and implementation issues live in `.scratch/` according to [the tracker conventions](docs/agents/issue-tracker.md).

Keep pull requests focused on one change. Describe the resulting behavior and checks. Changes to issue parsing or editing should demonstrate that unrelated Markdown is preserved and stale writes are rejected. If a proposal changes an architectural decision, identify the existing ADR and explain why.

## Working with agents

Read [AGENTS.md](AGENTS.md). Keep machine-specific paths, credentials, and private issue content out of committed examples; use fixtures written for this project.

The React Router 8 development dependency requires Node 22.22 or newer for checkout builds and tests. The packed CLI retains its Node 22.12 runtime minimum because client libraries ship as browser assets.

### Shared interface components

`Workspace.tsx` renders production navigation and the persistent reading pane. Folder expansion, scopes, view settings, filters, and open paths live in router history. `Navigator.tsx` provides the shared Chakra dialog used by the retained issue tools; its former workflow navigator remains covered independently by legacy adapter tests. `Picker.tsx` provides searchable Chakra comboboxes, and `MarkdownEditor.tsx` owns the Write/Preview tab and fixed-height frame. The Chakra theme uses an orange accent, bundled IBM Plex and Roboto Condensed fonts, and next-themes for system/light/dark appearance.

UI tests use roles and accessible names with relative path identities. The jsdom harness supplies browser adapters for media queries, animation frames, observers, CSS escaping, and scrolling. The map tests load the real React Flow stylesheet and provide deterministic measured geometry; real-browser verification checks actual pointer placement. Production journeys use `App` in `workspace-ui.test.mjs`; the retained write tests exercise the same query/router/form boundaries. The archived A reference is `477054d`; no prototype entry point ships.

### Candidate repair boundary

`POST /api/repair` accepts `{ path, expectedRevision, changes: { status?, type? } }` or `{ path, expectedRevision, content }`, with strict Zod validation, the existing session/origin restrictions, and a 1 MiB request limit (Markdown is limited to 500,000 characters). `type: null` removes the Type line. Only this endpoint permits remaining parser diagnostics through the shared writer; normal status/edit/comment writes still require valid issues before and after transformation. Every repair retains the same discovered-identity authorization, UTF-8 checks, revision rejection, queue, lock, and atomic replacement protections.

`repairMarkdown` in `document.ts` updates only the chosen leading metadata value, preserving its key style, spacing, line endings, and unrelated bytes; removal deletes only that Type line. Missing metadata inherits an existing key style and is inserted beside metadata or below the title. Duplicate/malformed chosen keys require raw editing rather than guessed line selection. The saved issue is always parsed on the server and can still have diagnostics.

`FixPanel.tsx` keeps choices and raw drafts in the open editor with their original issue/revision. `IssueDetails` combines repair and structured-editor dirty guards, preserving the earlier structured draft recovery if a valid file becomes malformed. The existing TanStack write mutation previews repaired content, retains the last server diagnostics/workflow until confirmation, and rolls back on error. Remaining diagnostics produce a warning toast; complete repairs name the returned board. Tests in `repair-api.test.mjs` and `repair-ui.test.mjs` cover preservation, explicit writes, metadata/raw repairs, partial diagnostics, stale/concurrent saves, session/path validation, preview, confirmations, optimistic rollback, and retained choices. Existing filesystem-race and interrupted-lock limitations still apply; no new runtime dependency was added.

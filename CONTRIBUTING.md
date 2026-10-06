# Contributing to md-kanban

Start with the [v1 specification](.scratch/markdown-kanban/spec.md), [glossary](GLOSSARY.md), and [architectural decisions](docs/adr/). The current slice launches a local app with discovery, safe status changes, issue creation/editing/comments, Markdown details, dependency navigation, and search/filters.

## Setup and checks

Use Node 22.12 or newer and pnpm 11.21.0 (the version pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

`pnpm check` runs type checking, the production build, and the full test suite. Tests launch real loopback servers and install a tarball into temporary directories. Test files run sequentially because the packed-package check rebuilds shared `dist` assets; concurrent server tests could otherwise observe the build directory being replaced. The packed-package test uses the pnpm store offline after `pnpm install`; it requires permission to bind local ports. Parser/discovery/dependency checks use portable temporary Markdown fixtures. UI checks render both workflows and attention diagnostics through React, and exercise search/filter, details/dependency, keyboard status changes, and simulated drag/drop with React `act` and jsdom. Creation, status and React Hook Form interactions use the real HTTP API and disk, including explicit field/body saves, safe previews, scoped dependencies, comment append, navigation drafts, stale recovery, and lost comment responses; network-failure checks replace only the fetch transport. API checks cover preserved Markdown bytes, permissions, revisions, external edits, simultaneous writes within and across processes, session/origin/path restrictions, and recoverable failures. Creation checks cover convention matching, scope allocation, occupied numbers, overlapping launches, stale container snapshots, validation, disk failures, draft preservation, and lost-response retries. No private issue fixtures are needed. After changing server/shared modules, rebuild before running individual test files because they import `dist/server`.

## Local development

```sh
pnpm dev --no-open ./
```

This builds both TypeScript server code and the Vite frontend, then launches the real CLI. It has no file watcher yet; after source changes, stop with Ctrl+C and rerun. For an existing build:

```sh
pnpm start --no-open ./
```

For caller-cwd behavior, run `node /path/to/checkout/dist/server/cli.js --no-open` from another directory. Replace the example path with your checkout. Frontend assets are resolved beside the installed server, never from the selected folder.

## Packed-package verification

This POSIX shell recipe builds and installs the local package without publishing:

```sh
verification_dir=$(mktemp -d)
pnpm pack --out "$verification_dir/md-kanban.tgz"
mkdir "$verification_dir/installation" "$verification_dir/issues"
cd "$verification_dir/installation"
printf '{"private":true}\n' > package.json
pnpm add --offline --ignore-scripts "$verification_dir/md-kanban.tgz"
./node_modules/.bin/md-kanban --no-open "$verification_dir/issues"
```

Open the printed URL. Confirm the project name, selected folder, empty implementation columns, and workflow switching. To see a real card, create `01-example.md` in the temporary `issues` folder with `# 01: Example` and `Status: ready-for-agent` on separate lines, then reload. Open the card, read its Markdown, and try searching and filtering. Drag it to `needs-info`, then use Change status to move it back; inspect the Markdown on disk. Edit the issue externally without reloading and attempt another move: confirm the conflict, refreshed status, and preserved external content. Open Edit issue, change its title/body, preview, and Save issue; append a comment separately and inspect the preserved content. Change a field, switch issues, and return to verify its retained draft. Use Reload issues, keep draft after an external edit, then review/recover before saving. Add another numbered issue with `Blocked by: 01 — Example` to verify dependency navigation. Use New issue to create another issue, verify its details and search without restarting, and inspect its allocated number on disk. Change an existing issue externally after opening creation, then confirm rejection and draft retention; reload containers explicitly before retrying. Press Ctrl+C to stop. Remove the temporary directory with `rm -rf "$verification_dir"` after inspecting it. `pnpm pack` runs type checking and rebuilds the package automatically; its file allowlist includes compiled assets and public documentation only.

## Discovery boundary

`GET /api/issues` returns issues and directory warnings within the launch root. Each issue carries a root-relative path identity, container, feature/location context, diagnostics, original Markdown, and SHA-256 content revision for stale-write checks. The parser validates metadata using Zod; invalid candidates stay outside both workflows. Metadata is read from the leading block, so body examples and comments do not change status. The parser and status patch share these boundaries, including both bold-colon styles and UTF-8 BOMs.

Repository discovery traverses supported `.scratch` and `docs` trees; tracker/feature launches find nested `issues` and `tickets` containers, and direct issue folders read numbered candidates. Discovery skips symlinks, ADRs, supporting-document filenames, generated assets, and dependency directories. Failed issue reads become attention entries; failed directory reads become warnings. Files are read anew on each page reload; file watching belongs to a later ticket.

`src/server/dependencies.ts` is pure shared read logic: resolve numbers within feature/location context using the entire discovered board, rather than filtered cards, and retain ambiguous/missing/unsupported references. Only a valid wayfinding prerequisite's `resolved` state establishes resolution; implementation references remain advisory. `Board.tsx` selects issues by path identity and composes case-insensitive search with location and scoped feature filters. `IssueDetails.tsx` renders the preserved document, including comments, with `react-markdown`/`remark-gfm`, `skipHtml`, and the library's safe URL transform. Do not add raw-HTML plugins or disable URL sanitization. The original-text view remains available for diagnostics. Supporting-document links are deferred to ticket 08.

## Write boundary

`GET /api/context` returns the selected folder and a random `sessionToken` scoped to this server launch. `POST /api/status` requires JSON `{ path, expectedRevision, status }` and the `X-Md-Kanban-Session` header; Zod rejects missing/extra fields, invalid revisions/paths, and unsupported statuses. The host must exactly match the printed loopback URL. Supplied Origin and Fetch Metadata headers must describe an allowed local request; other origins, same-site requests from another port, DNS-rebinding hosts, and other app sessions are rejected. No CORS access is enabled, and framing is prohibited. Tokens stay in browser memory and are not placed in URLs or logs. Status request size is capped at 16 KiB; editor/comment requests are capped at 1 MiB, with body/comment fields limited to 500,000/100,000 characters. Non-browser clients may omit Origin/Fetch Metadata but still need the session token and correct host.

`src/server/writes.ts` provides `createIssueWriter(...).update(identity, transform)`, the shared boundary for all field/body/comment mutations. Reuse it with the loaded revision; do not add direct file writes for existing issues. New issues use the separate exclusive creation boundary described below. It accepts only discovered issues under the selected root, refuses symlinks, validates current metadata and UTF-8 bytes, and checks the file revision and opened-file identity. Status transitions must retain the recognized workflow; Needs attention documents stay unmodified. Writes to one path are queued within a process. An exclusive sibling lock protects cooperating md-kanban processes, including servers launched against overlapping roots. A failed or stale save releases the queue and lock. If a process crashes, the lock remains intentionally: stop all md-kanban processes and remove the reported `.md-kanban-*.lock` beside the issue before restarting. Orphan `.md-kanban-*.tmp` files can be removed while processes are stopped.

The writer applies a targeted transform, writes and syncs a temporary sibling file, preserves ordinary permission bits, rechecks the original revision/identity, then atomically renames the replacement. Normal failure leaves the original intact and cleans up temporary files. Atomic replacement changes the file inode; extended filesystem metadata such as ACLs/xattrs and hard-link relationships are not preserved. Revision checks reject external edits made since loading, but an external editor that ignores the lock can still race the final check and rename: portable Node APIs provide no atomic compare-and-replace against those writers. Likewise, the selected tree must remain in place during a save; path/symlink checks are not an OS-level sandbox against hostile concurrent directory replacement.

The UI uses the returned persisted issue/revision, rather than showing an optimistic move as saved. All status controls pause during a save. Errors and lost responses refresh board data; if refresh also fails, the previous data remains with an explicit outdated-state warning. The editor also retains drafts on navigation, save failure, and reload; watching remains ticket 07.

`POST /api/edit` requires `{ path, expectedRevision, changes }`, where `changes` contains only changed `title`, `status`, `dependencies` (root-relative issue identities), and/or `body` fields. `POST /api/comment` requires `{ path, expectedRevision, comment }`. Both reuse the status API's session/origin checks and `writer.update`; every operation, including no-op requests, checks the expected revision. Invalid titles, wrong-workflow statuses, cross-effort/self/ambiguous dependency selections, and unsafe body/comment section boundaries reject without writing. Newly selected dependencies serialize as numbers; equivalent resolved selections retain their original text.

`src/server/document.ts` shares leading metadata offsets with the parser and separates the body from the first level-two Comments section outside fenced code. The body excludes its surrounding blank-line separators. Comments end at the next level-one/two section; appends preserve that suffix. Repeated Comments sections and unclosed fences have no guessed editor layout. Only requested ranges change; edited body/comment newlines adopt the original document's LF/CRLF convention. `edits.ts` combines structured/body patches, and the writer reparses the result before replacement. The parser takes the number/title from the first issue heading, so numbered headings inside body examples cannot redefine an unnumbered issue heading.

`IssueEditor.tsx` uses React Hook Form with runtime Zod validation and the shared `SafeMarkdown` renderer. `Board.tsx` retains per-issue drafts with their original values and revision. Reload/failure updates confirmed disk data while retaining those snapshots. Explicit recovery overlays changed fields onto the loaded version; changed bodies require manual reconciliation of overlapping edits. Field saves retain an unsent comment; comment saves retain unsaved field edits and update their known revision. Drafts remain in memory, with a before-unload warning and copyable recovery for removed/unsupported issues. Do not silently rebase a stale draft or persist private draft text to browser storage. Lost responses can follow a successful write; a stale retry is rejected, and comment recovery directs the user to inspect disk first.

`GET /api/creation-targets` returns existing containers with recognized workflows and SHA-256 snapshot revisions. Each snapshot includes discovered issue revisions/diagnostics in the same feature/location, occupied directory names, and directory identities. An empty or entirely unsupported container cannot establish a workflow. `POST /api/create` requires `{ container, workflow, expectedRevision, title, status, body, dependencies, type? }`; `container` is root-relative or `.` for the selected issue folder. The endpoint shares session/origin checks, strict Zod validation, and the 1 MiB request limit. Dependencies are root-relative identities in the same discovered scope. Type is available only for wayfinding and defaults to `task`.

`src/server/creation.ts` authorizes discovered containers, refuses symlink paths, and acquires `.md-kanban-create.lock` in each discovered container of the selected scope in sorted order. Cooperating processes and overlapping launch roots share these lock paths; locks stay inside the selected boundary. It checks the loaded container snapshot, allocates above every occupied/discovered number in that scope, and uses an existing valid issue in that container/workflow as the style reference (the first in board order). It preserves number width, filename separator, numbered/unnumbered heading style, heading separator, recognized metadata key style, and LF/CRLF convention; unsupported filename styles fall back to numbered Markdown with a safe title slug. Unicode titles remain in Markdown; filename slugs transliterate combining accents and restrict characters to ASCII letters, digits, and hyphens, falling back to `issue`. Unknown metadata and body from the reference issue are not copied. New body/dependency rendering reuses the editor's validated transforms and reparses before publication.

Creation writes and syncs a private temporary sibling, rechecks the snapshot, then hard-links it to the final filename. Hard-link publication is atomic and fails if any destination already exists; it never uses overwriting rename. Successful files are created with owner-only permissions (`0600`). Normal outcomes remove temporary files and locks. Interrupted creation can leave `.md-kanban-create.lock` or `.md-kanban-*.tmp`; stop all app processes before removing them. Filesystems that cannot create hard links report a recoverable failure. Scope is limited to discovered issues inside the launch root, including number/dependency allocation; a direct-folder launch does not inspect sibling containers outside that boundary. External editors do not take these locks and can race the final snapshot check or independently introduce duplicate numbers with different filenames. Publication still cannot overwrite their files. Hostile directory replacement has the same path-check limitations as the existing writer.

`IssueCreator.tsx` uses React Hook Form, shared runtime schemas, and `SafeMarkdown`. It stays mounted when closed so drafts survive navigation. It retains the original target revision until an explicit container reload and keeps all input on rejected/unconfirmed creation. Success inserts the returned persisted issue, clears filters, switches to the matching board, and opens details. Lost responses refresh disk without claiming success or discarding the draft; stale retries cannot silently create a duplicate. Reload failure gives an outdated-data warning. Existing issue drafts are retained throughout creation.

## Proposing changes

Open an issue at [crankshift/md-kanban](https://github.com/crankshift/md-kanban/issues) to discuss a bug, design change, or feature proposal. Internal specifications and implementation issues live in `.scratch/` according to [the tracker conventions](docs/agents/issue-tracker.md).

Keep pull requests focused on one change. Describe the resulting behavior and checks. Changes to issue parsing or editing should demonstrate that unrelated Markdown is preserved and stale writes are rejected. If a proposal changes an architectural decision, identify the existing ADR and explain why.

## Working with agents

Read [AGENTS.md](AGENTS.md). Keep machine-specific paths, credentials, and private issue content out of committed examples; use fixtures written for this project.

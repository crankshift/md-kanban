# Contributing to mdboard

Start with the [approved folder/status design](.scratch/folder-status-boards/map.md), the resolved Answers of its six decisions, [execution tickets](.scratch/folder-status-implementation/spec.md), [glossary](GLOSSARY.md), and [ADRs](docs/adr/). The approved A reference is `4ce592d` on `prototype/folder-status-boards-2026-10-08`. Inspect it with `git show`; keep its archive intact. Production has no fetch interception, in-memory file simulator, preview server, variant switcher, diagnostic inspector, or synthetic failure controls.

## Setup and checks

Use Node 22.22 or newer for checkout builds and pnpm 11.21.0, pinned in `package.json`. The packed CLI retains Node 22.12 as its runtime minimum. Respect pnpm's configured package maturity policy; pin necessary additions and keep browser-only libraries in devDependencies.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm check
```

`pnpm check` runs type checking, build, and the complete suite. Tests run sequentially because the package test rebuilds shared assets. Disk/API tests use portable temporary fixtures and real loopback servers; grant local port access. Rebuild before individual server tests, which import emitted `dist/server` code. UI tests mount the production App against a real server/disk with jsdom, React act, and a fetch-backed EventSource. The pointer test supplies deterministic geometry while exercising the real drag sensor. Transport-only failures cover rollback and lost-response draft recovery. `tests/package.test.mjs` packs, installs offline outside the checkout, and checks runtime discovery, authoring, assets, live events and shutdown. It needs an initialized pnpm store.

## Local production preview

```sh
pnpm dev --no-open ./
# or, after building:
pnpm start --no-open ./
```

The CLI binds to loopback, serves installed assets rather than the selected tree, and prints its exact local URL. Use that host and port for automation; never weaken Host, Origin, Fetch Metadata or session checks. It does not rebuild source automatically. After source/build changes restart the CLI and reload browser assets. Use disposable Markdown folders for authoring verification; keep fixtures/screenshots outside the checkout.

Verify light/dark and narrow layouts, folder scope/eyes, root and empty folders, hidden links, authored status collisions and diagnostics, filtering without disappearing destinations, real mouse shadow movement, keyboard pickup/arrows/drop/Escape/focus, touch activation when a physical device is available, generic editing/comments, arbitrary-status creation and folder cancellation. Inspect actual file bytes, stale/failure rollback and retained drafts. Record physical-device limitations honestly.

Preserve map checks: `A.md → B.md` and `C.md → B.md`, select A, hover C's center/borders, then edit/reload. C must remain stationary/visible and its connection stable. Check global Overview/Directed/Folders, reciprocal directions, local branches, safe relative/reference links/fragments and browser Back. Never discard React Flow's measured node geometry during controlled updates.

## Collection and visibility

`GET /api/documents?hide=<JSON array>&show=<JSON array>` returns visible documents, relationships, warnings, the canonical root, folder inventory, and hidden roots. Every launch recursively scans root and arbitrary Markdown descendants. Folder names and issue conventions never establish membership. Hidden roots remain inventory rows without traversing their dependency Markdown; showing a root expands it on demand. `.git` is permanently protected. Ordinary `.scratch`, `.agents` and `.codex` folders are visible by default. Other default-hidden basenames are listed in README.

`GET /api/document?path=...` and `/api/document-link?from=...&href=...` allow explicit in-boundary hidden reads while leaving collection membership unchanged. Reads check components, regular-file identity, symlinks and the 2 MiB bound. Visibility belongs to each request/query key and URL, never a global access-denial set. Edges exist only between visible indexed endpoints; dependencies require explicit Markdown targets and never derive state from status labels. The legacy `/api/issues` adapter is separate from discovery and authoring eligibility, retains its response shape, and no longer classifies workflows from statuses.

Metadata parsing retains every occurrence and diagnostics. Status identities use `value:` plus case-folded text, with separate `@none`/`@check` system identities. Blank values are missing; duplicate equal values stay in their group but disable structured writes. Non-text YAML and conflicting values require explicit source correction. Failsafe property display retains authored scalar text; status eligibility separately checks YAML scalar type. YAML/Markdown AST parsers stay server-side.

## Write boundary

`GET /api/context` returns a launch-scoped random session token. All POSTs require JSON and `X-Mdboard-Session`. Host must match the printed URL exactly; supplied Origin and Fetch Metadata must describe the allowed local request. No CORS access is enabled; framing is prohibited. Tokens stay in memory, never URLs/logs. Both document and folder creation use these checks, safe relative paths and a pinned launch root.

- `/api/status`: `{path, expectedRevision, status: string | null}`. Authored single-line labels are unrestricted. Same-status/case-only transitions are no-ops. `status.ts` patches existing YAML scalar or leading plain/bold property ranges, inserts a missing value into frontmatter or beneath the title, and removes only Status for null. Ambiguous chosen metadata is never guessed.
- `/api/source`: `{path, expectedRevision, content}`. Saves deliberate complete source, including metadata correction.
- `/api/comment`: `{path, expectedRevision, comment}`. Appends using the existing section-preserving Comments contract; duplicate Comments/unclosed fences reject without guessing.
- `/api/create` (also `/api/documents/create`): `{folder, filename, title, status?, body?}`. Folder is root-relative, with `''` for launch root. Filename is one Markdown basename. Emits minimal Markdown with no schema/workflow fields. Publication never overwrites existing names.
- `/api/folders`: `{parent, name}`. Parent is root-relative, `''` for root; name is one safe basename. Creates an immediate real directory, independent of an issue draft.

The legacy `/api/edit` and `/api/repair` adapters retain explicit structured/source operations with authored status/type values; production forms use the generic source/status/comment contracts. `/api/creation-targets` and workflow-bound creation are retired. Status requests are capped at 16 KiB; other write requests at 1 MiB. Source/body fields allow 500,000 characters; comments allow 100,000. No write can publish over the 2 MiB preview bound.

`writes.ts` is the shared revision/transaction boundary for existing documents. Writable identity is a safely read Markdown file, independent of issue discovery, collection visibility, numbering or workflow. It checks SHA-256 revisions, UTF-8, regular-file/opened identity and symlink components, serializes per path, and takes an exclusive sibling lock across cooperating processes. A transform writes/syncs a private temporary sibling, preserves permission bits, rechecks source identity/revision, then atomically renames. Normal failures clean temporary files and locks. No-op writes still validate the expected revision.

`document-creation.ts` takes `.mdboard-create.lock` in the chosen parent, pins directory identity, writes/syncs a private temporary sibling and publishes by exclusive hard link. Real folder creation uses the same parent checks/lock and mkdir, with no recursive/overwriting creation. New files use 0600 and directories 0700. An interrupted lock requires stopping all app processes before manual removal; interrupted temporary files can then be removed. Filesystems without hard-link support return a recoverable creation error.

Portable limitations remain: atomic replacement changes inode and does not retain ACLs/xattrs/hard-link relationships. An external writer ignoring locks can race the last check and rename; Node has no portable atomic compare-and-replace. Path checks are not an OS sandbox against hostile concurrent ancestor replacement. Keep the selected tree in place during writes. Exclusive creation still cannot overwrite another author's occupied name.

## Client state and live refresh

React Router URL state owns scope, visibility, navigation, search/property filters, open reader and dialogs. TanStack Query owns disk reads and every write. Forms own drafts and baseline revisions; no application Context/global store or browser draft storage. Explicit empty/emptied destinations have session-only, scope-keyed memory with contributing paths so hiding a subtree removes its contributed statuses. Reload discards unused destinations.

Writes cancel disk reads before optimism, disable conflicting moves/creation placeholders, roll back failures, and invalidate on settlement without awaiting a refetch that must wait for the pending mutation. Confirmed content/revisions come from disk. Source/comment forms stay mounted across refreshes/removals, offer latest-source review and explicit reapply/discard, and guard closure/Back/unload. Failed mutation variables keep submitted drafts recoverable until explicit discard or successful recovery. Never automatically retry writes; a lost response may already have appended/created.

`StatusBoard.tsx` lazily loads mature `@dnd-kit/core` sensors/overlay. Pointer activation distinguishes clicks from dragging; touch uses deliberate hold activation. The overlay is portalled out of board clipping, preserves size/grab offset, and disables hit testing. The original stays in place faded. Keyboard arrows target available status columns, Space/Enter drop, Escape cancels, and announcements/focus recovery accompany changes. Status controls provide a non-drag alternative. Card and column ordering remain out of scope.

`/api/events` accepts the same hide/show view and explicitly open `file`, starting an isolated watcher per connected stream. Fingerprints use visible directory/Markdown stat versions plus the explicitly open file, avoiding dependency Markdown parsing at startup. Revealed folders and hidden opened documents refresh without expanding membership. Events invalidate all disk query identities on ready/change; focus also repairs missed events. Native recursive watching falls back to polling; disconnect and server shutdown release subscriptions/watchers.

## Packaging and reviews

Keep the current version; pushing, merging, release and publication are separate tasks. The existing 500 kB emitted-JavaScript chunk limit remains unchanged. Browser libraries ship only as compiled assets; `open`, `yaml`, `unified`, `remark-parse`, `remark-gfm`, and `zod` remain runtime dependencies. The tarball excludes prototypes, fixtures, source maps, tests and private paths.

Every implementation ticket updates Unreleased CHANGELOG in its focused commit. Record checks and concrete limits in ticket results. Follow [AGENTS.md](AGENTS.md), the local tracker conventions and relevant ADRs; library-specific changes use current Context7 CLI docs outside the sandbox. Review standards and accepted-spec compliance before handoff.

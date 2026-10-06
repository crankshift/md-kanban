# 04: Persist status changes without overwriting other edits

Status: ready-for-agent
Blocked by: 03

## Outcome

A user can drag a card to another status column and have that status saved to its original Markdown file, with visible recovery when a write fails or conflicts.

## Scope

- Introduce the shared write boundary needed by this and later editing issues: validate requests, require the expected file revision, constrain paths to the selected root, and reject stale writes.
- Patch only the issue's status metadata, preserving its existing plain/bold style and all other bytes outside the intended change.
- Persist cross-column drag operations immediately. Provide an accessible status-change alternative and preserve feature/number ordering rather than introduce priority ranks.
- Report failures and stale-write conflicts clearly; do not leave a failed optimistic move displayed as if it succeeded.
- Allow transitions despite advisory dependencies; restrict statuses to the issue's recognized workflow.
- Keep write requests tied to the local app session and prevent arbitrary sites or paths from writing through the local server.

## Acceptance criteria

- Both metadata styles update correctly while unknown sections, checkboxes, comments, and unrelated formatting remain intact.
- An external edit after loading causes the stale status save to be rejected, leaving the external version intact.
- Concurrent writes based on the same revision cannot both silently succeed; later editing operations can reuse this behavior.
- Invalid statuses, out-of-root paths, and invalid write requests fail without altering files.
- Write errors restore or refresh the displayed card status and give the user an actionable result.
- Relevant disk/API/UI integration checks, type checking, and production build pass.

## Comments

### Implementation result — 2026-10-06

- Added immediate cross-column drag saves and a keyboard/touch-accessible Change status selector on cards and in issue details. Controls offer only the issue's recognized workflow statuses, pause while a save is pending, and permit transitions despite advisory dependencies. Cards retain feature/number ordering; same-column moves do not persist ranks. Details and dependency indicators update from the saved issue.
- Added `POST /api/status` with strict Zod validation of `{ path, expectedRevision, status }`, a 16 KiB request limit, and a per-launch session token delivered by `/api/context` and required in `X-Md-Kanban-Session`. Exact loopback Host, supplied Origin, and Fetch Metadata checks reject other sites, other app sessions, and DNS-rebinding hosts. No CORS access is enabled; framing is denied. Invalid requests, workflow changes, unsupported metadata, arbitrary supporting documents, escaped paths, and symlinked paths leave issue files unchanged.
- Introduced reusable `createIssueWriter(...).update(identity, transform)` in `src/server/writes.ts`. It authorizes discovered issue identities within the selected root, validates revisions/current metadata/UTF-8 bytes, checks path components and opened-file identity, queues writes per path, and uses an exclusive sibling lock across cooperating md-kanban processes. Concurrent saves from the same revision cannot both silently succeed. The writer prepares and syncs a temporary sibling, preserves ordinary file permissions, rechecks revision/identity, and atomically replaces the original. Normal success and failure clean up locks and temporary files; failed writes do not poison subsequent attempts.
- Reading and status patching now share the leading metadata boundary in `issues.ts`. The patch changes only the status value, preserving plain keys, both bold-colon styles, casing, whitespace, BOM, CRLF, unknown sections, body examples, checkboxes, existing comments, Unicode, and final-newline choices. Corrected heading recognition for UTF-8 BOMs as demonstrated by the preservation fixture.
- The board displays the last confirmed status while saving and moves a card only after persistence succeeds. Rejected writes, conflicts, and lost responses produce visible actionable messages and refresh from disk. If refresh also fails, the previous display remains with an explicit outdated-state warning and page-reload guidance. A stale save after an external edit leaves that external version and its comments intact.
- Updated README and contribution guidance for status controls, the HTTP/write boundary, verification, and recovery/limitations. Used the established React/TypeScript/Vite/Node/Zod stack; no new dependency or deferred product feature was added. Consulted official [Node filesystem](https://nodejs.org/api/fs.html), [Node HTTP](https://nodejs.org/api/http.html), [Zod](https://zod.dev/api), [React refs](https://react.dev/reference/react/useRef), [drag and drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API), and [Fetch Metadata](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site) documentation. Context7 was unavailable.
- Verification: final `pnpm check` passed strict type checking, production build, and all 35 tests. Targeted API/UI files and type checking ran during implementation. Disk/API checks cover preservation, refreshed revisions, external stale edits, simultaneous saves within and across CLI processes, abandoned locks, invalid requests/statuses/paths, symlinks, origin/host/session rejection, read-only disk failures, invalid UTF-8, cleanup, and retry. React/jsdom interaction checks use the real server and files for keyboard/drag persistence, ordering, advisory dependencies, updated details/badges, unchanged same-column/external drops, pending-state overlap prevention, conflicts, disk failures, and lost-response/failed-refresh recovery. The installed-tarball test verifies authenticated status persistence outside the checkout. Updated legacy context assertions for the session-token response. Diff whitespace checks passed; fixtures and paths are portable and public-safe. Loopback/package checks used execution outside the restricted sandbox, as in earlier tickets.
- Code review: Standards found no documented breaches or material issues; its optional small workflow-selection duplication was judged acceptable for this slice. Spec found no missing, extra, or incorrect ticket-04 behavior. Both reviews used the starting commit as the fixed point and included the new files.
- Browser limitation: the browser integration blocked the production loopback URL, native Computer Use permissions were denied, and automatic approval review rejected access to the blocked tab for that reason. No visual-browser success is claimed; the production build, real API/UI interactions, and installed-package checks passed. The disposable verification server was stopped and its fixture directory removed.
- Filesystem limitations: a crashed process can leave `.md-kanban-*.lock`/`.tmp` files; stop all md-kanban processes before removing those beside the affected issue and restarting. Atomic replacement changes the inode and does not preserve ACLs/xattrs or hard-link relationships. External editors that ignore the lock can race the final revision check and rename because portable Node APIs have no atomic compare-and-replace; hostile concurrent directory replacement is also outside the OS-level guarantees of path checks. Ordinary external edits made after loading and before saving are rejected and regression-tested.
- Context for ticket 05: reuse `issueWriteSchema`, the session/origin protections, and `writer.update` with the loaded revision for every title/status/dependency/body/comment mutation. Extend request validation per operation and use targeted transforms over the preserved Markdown; do not bypass the shared boundary with direct writes. Add React Hook Form and explicit editor saves while retaining drafts on conflicts and navigation. Body/comments remain read-only in this slice; watching, creation, and supporting-document navigation remain deferred. Triage status remains `ready-for-agent`; the workflow checkbox alone records implementation completion.

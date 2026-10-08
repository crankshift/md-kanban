# 02: Remove the legacy standalone board

Status: resolved
Blocked by: 01

## Goal

Stop shipping the standalone board UI that the product can no longer reach, and name the remaining component after what it does. See `../spec.md`.

`App.tsx` always renders `<Board … embedded />`. The non-embedded branch of `Board.tsx`, the `BoardView` status board, and the modules only that branch uses are dead in production.

## Requirements

- Delete from the client:
  - the non-embedded branch of `Board.tsx`, its `/api/events` EventSource (the Workspace has its own), and the `embedded` prop itself;
  - `BoardView` and anything only it uses;
  - `Navigator.tsx`, `DragBoard.tsx`, and `Documents.tsx`.
- Move the survivors next to their users:
  - `resolveLink` → `src/client/workspace/links.ts` (used by `WorkspaceReader`);
  - `Overlay` → `src/client/Overlay.tsx`;
  - `featureKey` only if the remaining code still uses it.
- Rename `Board.tsx` → `IssueTools.tsx` and the `Board` component → `IssueTools`. Issue tools (editing, commenting, creating, repairing, status changes) stay fully supported per ADR 0008.
- Remove the `@dnd-kit/dom` and `@dnd-kit/react` devDependencies and any other dependency left unused.
- Delete every test that mounts the legacy standalone path rather than porting it: `board-interactions`, `drag-board`, `navigator-ui`, `repair-ui`, `board-ui`, the non-application tests in `client-state`, the legacy-mounted test in `documents-ui` (the `renderBoard(t, files, true)` case), and the one in `live-refresh`. Keep tests that mount the production App (`application: true`) or exercise APIs and discovery.
- Make the production App the only mode of `tests/render-board.mjs` (drop the `application` option) and update callers.
- Leave server code unchanged; every endpoint remains used.

## Out of scope

- New coverage for stale-write and repair cases that existed only in the deleted legacy tests (accepted loss).
- Replacing `zod` on the client.

## Acceptance

- `pnpm check` passes; every emitted chunk stays under 500 kB, and the entry chunk contains no `@dnd-kit` code.
- No source or test references `Navigator`, `DragBoard`, `Documents`, `BoardView`, or `embedded`.
- In a real browser: reading, Files/Board/Map views, opening issue tools from the reader, editing, commenting, status changes, creation, and repair still work.
- `CHANGELOG.md` `Unreleased` notes the smaller client bundle.

## Comments

Implemented on `perf/client-bundle`, after ticket 01.

- Deleted `Board.tsx`'s non-embedded branch, `BoardView`, the `embedded` prop, its `/api/events` EventSource, `Navigator.tsx`, `DragBoard.tsx`, and `Documents.tsx` wholesale.
- Moved `resolveLink` (plus its private `fetchJson`/`errorOf` helpers) to `src/client/workspace/links.ts`, imported by `WorkspaceReader` and the renamed `IssueTools`. Moved `Overlay` to `src/client/Overlay.tsx`. `featureKey` had no remaining consumer once `BoardView`/`Navigator` were gone, so it was deleted rather than moved.
- Renamed `Board.tsx`/`Board` to `IssueTools.tsx`/`IssueTools`; `App.tsx` now renders `<IssueTools data=... sessionToken=... sessionProblem=... />` (no `folder`/`embedded` props — `folder` had no remaining use once `Navigator` was gone). Issue tools (editing, commenting, creating, repairing, status changes) are unchanged in behavior, only reached exclusively through the production Workspace reader now.
- Removed `Dependencies.tsx`'s `DependencyIndicators` export (and its private `badge` constant and the `Badge` import) since it was only used by the deleted `BoardView` card renderer; `DependencyList` (used by `IssueDetails`) is unchanged.
- Simplified `IssueTools`'s URL-state handling now that `embedded` is always true: dropped the `document`/`fragment` panel (no consumer left to open it), and the dead `workflow`/`query`/`location`/`feature`/`mode`/`sidebar`/`attention` nuqs keys that only `BoardView`/`Navigator`'s header and filters ever read. Kept nuqs/`NuqsAdapter` itself per ADR 0005 — it's still the project's URL-state mechanism, just not exercised by this particular simplified component via `useQueryStates` anymore (`setView` already drove the URL directly through `navigate`, not nuqs's setters).
- Removed `@dnd-kit/dom` and `@dnd-kit/react` devDependencies and ran `pnpm install`; no other dependency was left unused.
- Deleted `board-interactions.test.mjs`, `drag-board.test.mjs`, `navigator-ui.test.mjs`, `repair-ui.test.mjs`, `board-ui.test.mjs`, `documents-ui.test.mjs`, and `live-refresh.test.mjs` in full — every test in each of these files mounted the legacy standalone path (directly or through a shared `renderBoard(t, files, true)`/`liveBoard` helper) and exercised UI (status columns, drag-and-drop, the Navigator sidebar, the standalone document panel) that no longer exists in production.
- Trimmed `client-state.test.mjs` to its one test that already exercised the production App; the other 6 tests exercised the legacy direct-`Board` render path.
- `tests/render-board.mjs`: dropped the `application` option (the production App is now the only render mode), removed the now-unused `discoverIssues` import/`data` local and the dnd-kit-specific jsdom CSS-parsing workaround, and always wraps the render in `StrictMode`.
- Updated every surviving `renderBoard(..., { application: true, ... })` call site in `workspace-ui.test.mjs` to drop the now-meaningless `application: true`.

**Chunk sizes** (`dist/client/assets/*.js`, minified, after both tickets):

| File | After ticket 01 | After ticket 02 |
| --- | --- | --- |
| Entry (`index-*.js`) | 403,862 B | 275,447 B |
| `chakra-*.js` | 444,763 B | 424,821 B |
| `react-*.js` | 218,840 B | 218,840 B |
| `DocumentMap-*.js` | 244,779 B | 244,778 B |
| `SafeMarkdown-*.js` | 160,856 B | 160,855 B |
| `MarkdownEditor-*.js` | 35,583 B | 36,485 B |
| `IssueDetails-*.js` | 14,972 B | 17,325 B |
| `IssueCreator-*.js` | 5,347 B | 5,352 B |

No chunk exceeds 500 kB; the build emits no chunk-size warning. No built chunk contains `@dnd-kit`/`DragDropProvider`/`useDraggable`/`useDroppable` (checked directly against `dist/client/assets/*.js`).

**Checks run:** `pnpm check` (typecheck, build, full test suite — 82/82 passing, down from 139 after deleting the legacy-only files). Confirmed by grep that no source or test file references `Navigator`, `DragBoard`, `BoardView`, or `embedded` (excluding unrelated server-side `document-types.ts`/`documents.ts` and the generic `groupDocuments` helper, which only share the word "document").

**Real-browser validation:** exercised the production build (`node dist/server/cli.js`) against a disposable fixture with Chrome, in both dark and light mode: Files/Board/Map views; opening a document in the reader (Markdown body, checkboxes, backlinks); opening issue tools from the reader; editing the title and saving; appending a comment; changing status via the sidebar picker (immediate write); repairing an unrecognized-status file (`FixPanel`'s "Set status" → "Apply fixes", confirmed it moved from "mystery" to "ready-for-agent" and joined the board); creating a new issue end to end. No application console errors. (One piece of friction unrelated to the app: the browser automation tool's CDP-driven navigation tripped the server's legitimate same-origin check that a real user-driven navigation/reload does not; worked around by reloading from an already-loaded same-origin tab rather than weakening the server's check, which was explicitly out of scope.)

**Limitations:** None identified against the ticket's acceptance criteria. The stale-write/repair test coverage that existed only in the deleted legacy-mounted tests is an accepted loss per the spec; App-mode coverage of issue tools (including a stale-draft-during-refresh test in `workspace-ui.test.mjs`) remains.

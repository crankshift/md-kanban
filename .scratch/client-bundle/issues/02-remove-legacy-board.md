# 02: Remove the legacy standalone board

Status: ready-for-agent
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

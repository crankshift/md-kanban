Shrink mdboard's shipped client bundle in `/Users/crankshift/khmara/projects/md-kanban-board`.

Complete issues `.scratch/client-bundle/issues/01-split-client-bundle.md` and `.scratch/client-bundle/issues/02-remove-legacy-board.md` end to end, in that order, on a single implementation branch. The scope was agreed in a design session on 2026-10-08 and is recorded in `.scratch/client-bundle/spec.md`; the issues are the requirements and acceptance source of truth. Resolve routine technical choices from that scope and the current code.

## One branch

Use exactly one branch, `perf/client-bundle`, based on `main`, in the existing checkout. Inspect the working tree first and preserve unrelated work; reuse the branch if it already exists. Make one focused commit per ticket (01, then 02), each including its CHANGELOG `Unreleased` entry and ticket comments. Do not create per-ticket branches, worktrees, or pull requests. Do not push, merge, publish, or change the release version.

## Read first

Read `AGENTS.md` and the agent docs it references, `.scratch/client-bundle/spec.md`, both issues, `GLOSSARY.md` (note the new **Issue tools** entry and that **Board** names the generic grouped view), and ADRs 0001, 0004, 0005, and 0008 before changing code.

## Ticket 01: split the client bundle

The entry chunk is 1,284 kB because everything except `DocumentMap` is eager. Lazy-load the issue tools overlays (`IssueDetails`, `IssueEditor`, `IssueCreator`, `FixPanel`, `Dependencies`, pulling `react-hook-form` with them) with a `null` Suspense fallback, and lazy-load `SafeMarkdown` behind one shared boundary so the whole Markdown pipeline lands in a single chunk; the reader's fallback is `<Text role="status">Loading document…</Text>`, matching `MapView`. Keep the Workspace shell and its small views eager.

Add `react` and `chakra` vendor groups through Vite 8 / Rolldown `build.rolldownOptions.output.codeSplitting` exactly as listed in issue 01, and keep `chunkSizeWarningLimit` at its default. Look up the current Rolldown `codeSplitting` API with the find-docs skill / Context7 CLI (`npx ctx7@latest library`, then `npx ctx7@latest docs`) rather than relying on Rollup's `manualChunks` from memory. Add the test that fails when any `dist/client/assets/*.js` exceeds 500 kB.

Existing UI tests mount the client through `tests/render-board.mjs` under jsdom; where lazy content now arrives asynchronously, wait for it instead of weakening assertions. Verify with a sourcemap build that the entry chunk no longer contains the Markdown pipeline or `react-hook-form`.

## Ticket 02: remove the legacy standalone board

`App.tsx` always renders `<Board … embedded />`, so the non-embedded branch, `BoardView`, `Navigator.tsx`, `DragBoard.tsx`, and `Documents.tsx` are unreachable. Delete them along with the `embedded` prop, that branch's `/api/events` EventSource, and the `@dnd-kit/*` devDependencies. Move `resolveLink` to `src/client/workspace/links.ts` and `Overlay` to `src/client/Overlay.tsx`; keep `featureKey` only if still used. Rename `Board.tsx` / `Board` to `IssueTools.tsx` / `IssueTools`. Issue tools themselves stay fully supported.

Delete, rather than port, every test that mounts the legacy standalone path; issue 02 lists them. Make the production App the only mode of `tests/render-board.mjs`. The loss of fine-grained stale-write and repair coverage that lived only in those tests is accepted. Server code does not change.

## Validation and completion

After each ticket run `pnpm check`; the build must emit no chunk-size warning. After ticket 02, confirm no source or test references `Navigator`, `DragBoard`, `Documents`, `BoardView`, or `embedded`, and that the entry chunk has no `@dnd-kit` code. Exercise the production build in a real browser with a disposable fixture: Files/Board/Map views, opening documents in the reader, opening issue tools from the reader, editing, commenting, status changes, creation, and repair, in light and dark modes.

Append results, chunk sizes before and after, checks run, and any limitations under `## Comments` in each issue, and set each issue's `Status:` to `resolved` when done. Report the branch, commits, chunk sizes, validation, and any concrete remaining limitations. Stop after these two tickets.

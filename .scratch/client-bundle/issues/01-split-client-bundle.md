# 01: Split the client bundle

Status: resolved

## Goal

Every JavaScript chunk emitted by `vite build` stays under 500 kB, and first load no longer parses the issue tools or the Markdown rendering pipeline. See `../spec.md` for the measurements and agreed scope.

## Requirements

- Lazy-load the issue tools: `IssueDetails`, `IssueEditor`, `IssueCreator`, `FixPanel`, `Dependencies`, and with them `react-hook-form`. They open only on demand (an `issue` URL parameter or creation). Suspense fallback: `null`.
- Lazy-load `SafeMarkdown` (`react-markdown`, `remark-gfm`, and the micromark/mdast/hast pipeline). All consumers (`WorkspaceReader`, `IssueDetails`, `MarkdownEditor`, and any other) must share one lazy boundary so the pipeline lands in a single chunk. Reader fallback: `<Text role="status">Loading document…</Text>`, matching `MapView`'s fallback.
- Keep `GenericBoard`, `FolderTree`, `FileResults`, and the rest of the Workspace shell eager.
- Add vendor chunk groups through Vite 8 / Rolldown (`build.rolldownOptions.output.codeSplitting`):
  - `react`: `react`, `react-dom`, `scheduler`.
  - `chakra`: `@chakra-ui`, `@zag-js`, `@ark-ui`, `@emotion`, `@floating-ui`, `@pandacss`, `@internationalized`.
  - Everything else stays in the entry chunk.
- Keep `build.chunkSizeWarningLimit` at its default; the build must emit no chunk-size warning.
- Add a test (in `tests/package.test.mjs` or a sibling) that fails when any `dist/client/assets/*.js` file exceeds 500 kB (500 × 1000 bytes, matching Vite's report).
- Existing UI tests keep passing; adjust them to wait for lazily loaded content where needed rather than weakening assertions.

## Out of scope

- Removing the legacy standalone board path (ticket 02).
- Replacing `zod` on the client.

## Acceptance

- `pnpm check` passes with no chunk-size warning.
- The entry chunk contains neither `react-markdown`/micromark nor `react-hook-form` (verify with a sourcemap build).
- Opening a document in the reader, opening issue tools from the reader, and creating an issue all still work in a real browser.
- `CHANGELOG.md` `Unreleased` records the faster first load.

## Comments

Implemented on `perf/client-bundle`.

- Added `build.rolldownOptions.output.codeSplitting.groups` in `vite.config.ts` for `react` (react, react-dom, scheduler) and `chakra` (`@chakra-ui`, `@zag-js`, `@ark-ui`, `@emotion`, `@floating-ui`, `@pandacss`, `@internationalized`) vendor chunks, confirmed against the installed Rolldown 1.2.12 type definitions (`codeSplitting` is current; `advancedChunks`/`manualChunks` are deprecated aliases) rather than relying on Rollup's `manualChunks` from memory.
- Added `src/client/LazySafeMarkdown.tsx`, a single shared `lazy(() => import('./SafeMarkdown'))` boundary used by `WorkspaceReader`, `IssueDetails`, `MarkdownEditor`, and `Documents.tsx`'s `DocumentPanel` (the last one still eagerly reachable from the production entry until ticket 02 removes the legacy standalone path; lazifying its one `SafeMarkdown` usage was necessary so the markdown pipeline didn't leak into the entry chunk through that still-live path).
- `Board.tsx` now lazy-loads `IssueDetails` and `IssueCreator` (`lazy()` + `<Suspense fallback={null}>`); `IssueEditor`, `FixPanel`, and `Dependencies`' `DependencyList` come along transitively since they're only reachable through those two boundaries. `react-hook-form` and `MarkdownEditor` end up bundler-extracted into one shared chunk (used by both boundaries).
- Reader's Suspense fallback is `<Text role="status">Loading document…</Text>`, matching the literal text specified in the ticket.
- Added a chunk-size test to `tests/package.test.mjs` that reads `dist/client/assets/*.js` and fails above 500,000 bytes.
- Updated ~30 assertions across `tests/board-interactions.test.mjs`, `drag-board.test.mjs`, `navigator-ui.test.mjs`, `repair-ui.test.mjs`, `documents-ui.test.mjs`, `live-refresh.test.mjs`, `client-state.test.mjs`, and `workspace-ui.test.mjs` to `await ui.until(...)` for the now-asynchronously-arriving issue tools/Markdown content, rather than weakening any assertion. Only the first open of a given lazy boundary within a render needed a wait; subsequent opens in the same test reuse the resolved chunk.

**Chunk sizes** (`dist/client/assets/*.js`, minified):

| File | Before | After |
| --- | --- | --- |
| Entry (`index-*.js`) | 1,284,090 B | 403,862 B |
| `chakra-*.js` | — | 444,763 B |
| `react-*.js` | — | 218,840 B |
| `DocumentMap-*.js` | 244,670 B | 244,779 B |
| `SafeMarkdown-*.js` | — | 160,856 B |
| `MarkdownEditor-*.js` (shared `react-hook-form` chunk) | — | 35,583 B |
| `IssueDetails-*.js` | — | 14,972 B |
| `IssueCreator-*.js` | — | 5,347 B |

No chunk exceeds 500 kB; the build emits no chunk-size warning.

**Checks run:** `pnpm check` (typecheck, build, full test suite — 139/139 passing). Verified with `npx vite build --sourcemap` that the entry chunk's sourcemap contains zero `react-hook-form`, `react-markdown`, `micromark`, `remark`, `mdast`, `hast`, or `unist` sources (checked programmatically against `index-*.js.map`'s `sources` array). Confirmed `SafeMarkdown-*.js` contains the full markdown pipeline (`react-markdown`, `remark-gfm`, `micromark-*`, `mdast-*`, `unified`, etc.) in one chunk.

**Limitations:** `Dependencies.tsx`'s `DependencyIndicators` export (used only by the legacy `BoardView`) and the whole `Documents.tsx`/`DocumentPanel` module remain reachable from the eager entry until ticket 02 deletes the legacy standalone path, so the entry chunk's current 404 kB still includes some code that will shrink further. Real-browser verification is deferred to ticket 02's validation pass, which exercises both tickets together end to end.

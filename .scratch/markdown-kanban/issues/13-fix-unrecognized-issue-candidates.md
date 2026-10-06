# 13: Fix unrecognized issue candidates from Needs attention

Status: ready-for-agent
Blocked by: 11

## Outcome

A user can fix a file that cannot be placed on the board by explicitly choosing what it should say, and the fixed issue appears on its board.

## Prototype reference

The fix panel was approved in the prototype at commit `3a6620a` (`FixPanel` in `src/client/prototype/shared.tsx`, `setMetadata` and `recheck` in `data.ts`). The prototype only re-checked status and type in the browser; this ticket validates on the server.

## Scope

- Add a write endpoint for unrecognized issue candidates, protected by the session header and stale-write rejection like the other writes. It accepts either chosen metadata changes (set `Status`, set `Type`, remove `Type`) or a full replacement of the file's Markdown made in the raw editor.
- Metadata changes rewrite only the affected lines and keep their existing key style (plain or bold); a missing `Status` line is inserted next to existing metadata or below the title. Everything else in the file stays byte-for-byte the same.
- The server re-parses the result and returns the issue with its current diagnostics; the client never decides on its own that a file is fixed.
- In the issue dialog, replace the diagnostic list with a fix panel: one row per problem, explaining it in plain language with the matching control. Status problems get a picker listing the statuses of both workflows, labelled with their workflow. An unknown type gets a type picker. An implementation status next to a `Type` line offers to remove the `Type` line or to choose a wayfinding status instead. Other problems point to the Markdown editor. "Apply fixes" writes all chosen changes at once.
- "Edit Markdown" opens the whole file in the Write/Preview editor; closing it with unsaved changes asks for confirmation.
- Apply optimistically and roll back on failure. When no diagnostics remain, the issue moves onto its board and a toast names the board; otherwise the remaining problems are shown.

## Acceptance criteria

- Choosing a status for a file with an unknown or missing status places it on the matching workflow's board and changes only that line.
- An implementation status with a `Type` line can be fixed either by removing the `Type` line or by choosing a wayfinding status.
- An unknown wayfinding type can be replaced with a supported type.
- Saving edited Markdown re-parses the file and shows any remaining diagnostics.
- A fix based on stale file contents is rejected and leaves the file unchanged.
- No file is ever changed without an explicit Apply or Save.
- Relevant API and UI tests, type checking, and the production build pass.

## Comments

### Implementation result — 2026-10-06

- Added `POST /api/repair` (`src/server/server.ts`, `repairSchema` in `src/server/board.ts`). It accepts either `changes` (`status`, `type`, with `type: null` removing the Type line) or full replacement `content`, uses the session header, origin restrictions, a 1 MiB request limit, and the shared writer's revision, queue, lock, and atomic-replace protections. Only this endpoint passes `allowDiagnostics` to `writer.update`, so status, edit, and comment writes still require valid issues.
- `repairMarkdown` in `src/server/document.ts` rewrites only the chosen metadata value, keeping key style, spacing, line endings, BOM, and unrelated bytes. A missing key is inserted beside existing metadata or below the title. Duplicate or malformed chosen keys are rejected with a message pointing to the Markdown editor. The server re-parses the saved file and returns it with its current diagnostics.
- Added `src/client/FixPanel.tsx`, which replaces the diagnostic list in the issue dialog: workflow-labelled status picker, type picker, a Remove Type checkbox for implementation-status conflicts, **Apply fixes**, **Reset fixes**, and **Edit Markdown** (Write/Preview, **Save file**, confirmation on discarding). `IssueDetails` merges its dirty state with the structured editor's. The existing TanStack write mutation previews the repaired content, rolls back on error, shows a warning toast when diagnostics remain, and names the board when none do.
- Tests: `tests/repair-api.test.mjs` and `tests/repair-ui.test.mjs`. Updated README, CONTRIBUTING, and Unreleased CHANGELOG.
- Verification: `pnpm check` passed strict type checking, the production build, and all 122 tests on macOS. The Type-controls UI test was split into two tests: with both fixes in one render, a toast left over from the first Apply intermittently dismissed the second dialog under jsdom when a picker option was clicked (about half of runs). This was not reproduced without the prior Apply and was not investigated in a real browser.
- Not done: no production-browser check and no Standards/Spec code review of this ticket yet. Existing filesystem-race and interrupted-lock limitations from earlier tickets still apply.

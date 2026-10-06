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

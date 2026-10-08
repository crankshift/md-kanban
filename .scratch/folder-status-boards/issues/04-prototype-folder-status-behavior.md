# Try folder-scoped statuses and issue creation

Type: prototype
Labels: wayfinder:prototype
Status: resolved
Parent: ../map.md
Blocked by: 01, 02, 03, 05, 06

## Question

Does the agreed folder/status model feel coherent when a person switches scopes, filters cards, changes statuses, and creates an issue with a new status?

Build and review a throwaway interactive prototype after the brainstorm. Exercise different sibling-folder vocabularies, nested scopes, folder hide/show, new and empty folders, no statuses, custom statuses, explicit editing/comments on ordinary documents, the agreed drag behavior, and any conflicting-metadata or failed-write cases needed to judge the design. Link the artifact and record the user's verdict; production implementation follows separately.

Prerequisites: [Define the folder and status board model](01-define-folder-and-status-board-model.md), [Define generic status edits and drag behavior](02-define-generic-status-edits.md), [Define issue creation with authored statuses](03-define-custom-status-issue-creation.md), [Define folder visibility behavior](05-define-folder-visibility-behavior.md), and [Define issue tools without workflow classification](06-define-issue-tools-without-workflow-classification.md).

## Comments

### Visual direction — 2026-10-08

The user preferred the board cards before the generic-workspace transition. Compare that historical presentation with the current cards as a prototype reference while keeping the generic folder/status model. Restored DnD means cards moving between status columns.

Historical reference: commit `3332036`, `src/client/Board.tsx` and `src/client/DragBoard.tsx`. It used compact title-first cards, condensed medium-weight titles, a small muted metadata row, simple bordered panels, whole-card dragging, muted column wells, and highlighted drop targets. These are reference facts, not a selected new layout; the user will judge the prototype.

### Brainstorm complete — 2026-10-08

All prerequisite decisions are resolved. The [prototype brief](../prototype-brief.md) provides the scenario checklist and references. Before building, obtain the final shared-understanding confirmation required by the invoked grilling skill; the prototype remains open until the user reviews its behavior and visual design.

### Prototype started — 2026-10-08

The user confirmed shared understanding with Q26. Use the logic/state branch of the prototype skill: a self-contained HTML board with in-memory public examples, free play, and guided scenarios. The primary question is whether the agreed folder/status behavior feels coherent; the earlier compact cards supply its visual reference. Capture the artifact on a throwaway branch and keep this decision claimed until user review.

### Prototype ready for review — 2026-10-08

- Primary-source branch: `prototype/folder-status-boards-2026-10-08`.
- Immutable capture: `064f7e4`, containing `src/client/workspace/folder-status-prototype.html` and its adjacent Markdown README. No production source or dependencies changed on that branch.
- [Open the standalone session copy](/private/tmp/mdboard-folder-status-prototype.html). Open it directly in a browser; no server, install, or network calls are required. The branch is the durable source if this temporary copy is removed.
- The demo uses public example documents, a pure in-memory model, compact title-first cards, pointer/keyboard card moves, a reader with source/edit/comments, folder eye controls, New folder and New issue dialogs, custom statuses, and readable state/Markdown inspection.
- Six guided walkthroughs cover scope/search/empty-column reload, first status, folder/issue creation, hidden reading, ambiguous metadata, and cancelled/rejected/stale moves. Simulate reload keeps mock documents and rediscovers columns; a real reload resets in-memory document changes while URL view state remains.
- Verification: inline script syntax passed; pure transitions preserved the YAML fixture, inserted/cleared status, kept empty columns until simulated reload, excluded hidden-only statuses, prevented ambiguous pickup, created a custom-status issue, and rolled back rejected/stale moves. Offline jsdom startup and all six walkthroughs ran without startup/runtime errors. Keyboard move/cancel and focus restoration, editable filename suggestions, new-folder persistence after cancellation, issue/comment dialogs, stale editor draft preservation, and all-visible URL reload were exercised. No tests or dependencies were added.
- Browser verification limitation: the Browser Use URL policy rejected the local-file preview. No alternate browser route was attempted after that rejection. Real-browser appearance and pointer/touch geometry remain for user review; the offline checks do not establish those behaviors.
- The demo parser is deliberately limited to its demonstrated metadata forms and is not a production writer. Map is a collection/link preview, not a replacement for the existing graph.

Awaiting the user's behavior/visual verdict. This HITL prototype decision is still claimed, not resolved; production implementation and promotion remain separate.

### User feedback and project-based replacement — 2026-10-08

The user expected a prototype from the project files, as with the prior workspace prototypes, and questioned the standalone HTML format. The initial logic-demo shape was the wrong fit for that expectation. It is superseded by a development-only project UI on the same prototype branch; `064f7e4` remains the historical standalone capture.

- Active primary source: `prototype/folder-status-boards-2026-10-08` at `3c4cf6d`.
- Entry: `src/client/main.tsx` gates `src/client/workspace/folder-status-prototype/PrototypeApp.tsx` behind the development preview flag. Adjacent `README.md`, `StatusBoard.tsx`, and `model.ts` document and supply the prototype.
- Run `pnpm prototype /path/to/markdown` from that branch. The session worktree is `/private/tmp/mdboard-folder-status-prototype-2026-10-08`.
- [Open the active project preview](http://127.0.0.1:4175/?view=board&variant=A&folder=.scratch%2Ffolder-status-boards%2Fissues). It reads the selected project's actual Markdown. All status moves, edits, comments, new issues, and new folders remain browser-only copies.
- Compare A (classic compact cards with a side reader), B (preview cards with a reading dock), and C (path-first cards with a focused reader dialog), on the existing `/` route via `variant` and the floating switcher.
- Reuses the project's actual theme/fonts, FolderTree, WorkspaceReader, SafeMarkdown, FileResults, MapView, Picker, Overlay, query cache, URL router, and document metadata/discovery modules. The preview shell follows production Workspace; no standalone HTML approximation or iframe remains at the branch head.
- Verification: strict typecheck and production build passed; production JavaScript contains no prototype entry/labels. Read-only API includes root README and folder inventory, rejects writes with 405 and foreign Host headers with 403. Shared-parser model checks preserved nested YAML properties and quote style, inserted/cleared a status, and rejected conflicting/non-text/duplicate structured moves.
- Real-browser verification in Brave: inspected actual dark-theme A/B/C layouts; keyboard status move and focus restoration; real mouse drag into No status; new empty folder, Add status, column-prefilled creation, invented status, generic comments, and hiding the selected folder with parent fallback. Empty columns persist through layout changes after fixing a remount/reset bug. The simulated folder was absent on disk and the real wayfinding issue stayed claimed after browser-only moves.
- The console included a React development warning about a client-rendered script tag on mount and Grammarly extension warnings; interaction checks succeeded. Physical touch-device behavior is unverified.

The current project preview is ready for user behavior/visual review. Keep this decision claimed until that verdict; the standalone artifact is no longer the handoff.

### Selected A and drag-preview refinement — 2026-10-08

The user selected A (“looks good A”) and requested that the dragged card itself follow the cursor with a shadow. Added a portalled, same-size preview that preserves the grab point, fades the original card, keeps the destination highlight, ignores hit testing, and clears on release/cancellation. The source card remains in place during pickup, and pointer target tracking no longer depends on a potentially stale React render.

Final capture: `4ce592d` on `prototype/folder-status-boards-2026-10-08`. Typecheck and production build passed. A real Brave pointer drag produced multiple moving preview positions at the source's 274px width, with a computed shadow, source opacity 0.3, pointer-events none, and a grabbing cursor. Release removed the preview and restored the cursor. Keyboard cancellation and an outside-column drop kept the original status, restored opacity, and did not open the reader. Temporary observation logging was removed before capture.

### Final approval — 2026-10-08

After the cursor-following shadow refinement, the user confirmed: “we go with A”. A and the refined drag behavior are the approved design reference for separate production implementation.

## Answer

The user approved **A — classic compact cards with a side reader**, including the cursor-following shadow card, after reviewing the refinement. Use the actual project UI and runtime Markdown. B/C remain archived comparison sources; the standalone HTML shape was rejected as the handoff format.

The authoritative prototype is `4ce592d` on `prototype/folder-status-boards-2026-10-08`, with its entry and README under `src/client/workspace/folder-status-prototype/`. [Open A](http://127.0.0.1:4175/?view=board&variant=A&folder=.scratch%2Ffolder-status-boards%2Fissues). All preview writes remain simulated. This resolves the design/prototype question; production implementation is separate and must preserve the agreed document/write boundaries rather than promote throwaway code directly.

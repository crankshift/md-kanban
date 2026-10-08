# Review folder-scoped status boards

The confirmed brainstorm establishes the target behavior, and the user selected A from the project-based UI prototype. [Try folder-scoped statuses and issue creation](issues/04-prototype-folder-status-behavior.md) records the verdict, drag-preview refinement, and final source capture. The user's feedback superseded the initial standalone logic demo: the reference uses the real project components, styling, and runtime document data, as the prior workspace prototypes did. This brief links the canonical decisions rather than duplicating their full answers. Production implementation is separate.

## Agreed decisions

- [Define the folder and status board model](issues/01-define-folder-and-status-board-model.md): discovery, folder scope, status columns, filtering, and restored card dragging.
- [Define generic status edits and drag behavior](issues/02-define-generic-status-edits.md): authored values, format-preserving writes, ambiguity guards, and Add status.
- [Define issue creation with authored statuses](issues/03-define-custom-status-issue-creation.md): target folders, filenames, optional status, and minimal Markdown.
- [Define folder visibility behavior](issues/05-define-folder-visibility-behavior.md): hide/show, explicit reading, new folders, and URL view state.
- [Define issue tools without workflow classification](issues/06-define-issue-tools-without-workflow-classification.md): explicit Edit and Add comment for any document.

## Prototype question

Does the generic folder/status model feel coherent in use, and can compact cards inspired by the former board make it easy to find, read, create, and move documents without workflow-specific assumptions?

## Review scenarios

1. Open a launch folder containing root Markdown, docs/, .scratch/, tickets/, notes/, .agents/, and node_modules/. Find ordinary Markdown without a special folder name; reveal and hide the default-hidden dependency folder.
2. Select tickets/ with a nested archive/. Confirm descendant inclusion and a status vocabulary independent of notes/. Search for one card while the other status destinations remain available.
3. Move a card between status columns, including the last card in a column. Keep the empty destination available during the session, then simulate reload and rediscover file-backed statuses. Exercise a cancelled move and a failed/stale write with rollback.
4. Start with a status-free folder. Add a custom status and drag a document from No status into it. Move it back to No status and inspect the simulated Markdown change.
5. Create a folder from the tree and from the New issue picker. Keep the empty folder if issue creation is cancelled. Create an issue there with an editable filename and a newly invented status; compare toolbar creation with creation from a status column.
6. Show missing, blank, duplicate, conflicting, and non-text statuses. Keep documents visible without guessed status assignments; disable ambiguous structured status moves. Distinguish authored labels from the system No status and Check status groups.
7. Hide the selected subtree and move scope to a visible ancestor. Follow an explicit link to a hidden document without revealing its folder or adding it back to Board/Map.
8. Open an ordinary note or newly created issue, choose Edit, and add a comment. Require explicit saves, keep the reading view as the default, and show the resulting Markdown without imposing an issue schema.

## Visual reference and limits

Use the selected project's A layout and its cursor-following shadow card as the design reference. The compact title-first cards, muted metadata, simple borders, column wells, and drop highlighting in commit `3332036` (`src/client/Board.tsx` and `src/client/DragBoard.tsx`) supplied the historical reference. The final prototype capture is linked from the resolved decision above; B/C remain archived comparisons.

Use read-only runtime Markdown from the selected folder and keep changes in memory; do not commit private source documents as fixtures. The prototype must not write to the user's Markdown files or create real user folders. Mount the preview through the existing project entry/route, reuse shared components and styling, label it as throwaway, make it easy to run, and expose enough state/Markdown to judge the behavior. The active preview offers A (classic cards/side reader), B (preview cards/reading dock), and C (file cards/focused reader). Capture its artifact and verdict through [Try folder-scoped statuses and issue creation](issues/04-prototype-folder-status-behavior.md).

Automatic memory across fresh launches/changing ports is optional follow-up. The current target keeps visibility in the view URL; the prototype does not need persistent storage.

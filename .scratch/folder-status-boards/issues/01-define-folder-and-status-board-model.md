# Define the folder and status board model

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Parent: ../map.md
Blocked by: None

## Question

What collection does a folder-scoped status board represent, and how do its columns behave?

Settle recursive Markdown discovery from the launch boundary, folder selection and descendants, the source of status values, whether search changes available columns, missing/empty/conflicting status presentation, and behavior when the scope contains no statuses. Clarify whether restoring status drag-and-drop means moving cards between statuses, reordering status columns, or both; leave write mechanics to the dependent decision.

Use concrete scopes such as a repository with root Markdown plus docs/, .scratch/, notes/, and tickets/, including a status-free tickets/ folder and sibling folders with different status vocabularies. Distinguish discovery from authoring a workflow, and do not assume status values indicate progress or completion.

## Comments

### Brainstorm answers — 2026-10-08

- Discovery must cover all Markdown under the launch folder rather than depend on folder names. The user proposed folder hide/show icons, with node_modules and similar folders hidden by default; whether hiding affects navigation alone or collection membership remains open.
- Columns derive from authored statuses across the chosen folder scope before search and other card filters. Search must not remove status destinations, and sibling scopes must not contribute status values.
- A scope with no statuses shows its documents in one No status column without invented presets. The explicit action that introduces the first status will be settled with generic edits and creation.
- Restore card drag-and-drop between status columns, as in the previous board. The user also preferred the previous board card design; the prototype must revisit that visual reference. Column and card reordering were not requested.
- The folder-selection question was unclear. Re-ask using a concrete nested-folder example; do not treat the proposed descendant behavior as newly confirmed.

These are partial answers. Keep this decision claimed until folder visibility, scope selection, and status-column identity/lifetime are settled through the interview.

## Answer

The user accepted the following model through the brainstorm on 2026-10-08:

- Discover `.md` and `.markdown` throughout the launch folder, including root files and arbitrary nested folders, without a docs/.scratch/issues/tickets allowlist. Preserve the launch boundary and symlink protections.
- Select an actual folder path and include its descendants. Selecting tickets/ includes tickets/a.md and tickets/archive/b.md, while notes/c.md remains outside that scope.
- Provide folder hide/show eye controls. Hidden folders do not contribute documents to Files, Board, Map, or status discovery. Dependency/generated folders such as node_modules/, dist/, and build/ start hidden and can be shown on demand; ordinary folders, including .scratch/, start visible. .git remains excluded.
- Derive status columns from visible documents across the selected folder scope before search and other card filters. Sibling folders do not contribute statuses. Search filters cards without removing drop destinations.
- Treat labels differing only by letter case as the same status. Preserve original file spelling until an explicit edit.
- Missing and blank statuses belong to No status. Conflicting or non-text statuses belong to Check status, with no guessed status. A folder without statuses starts with one No status column and no invented presets.
- Restore dragging cards between status columns. Card ordering and column reordering are outside this effort.
- Keep a column after its last card leaves until page reload. Reload rediscovers columns from the files; no permanent status-definition configuration is implied.
- Use the former compact board cards as a prototype reference, subject to live prototype review.

The explicit first-status action, status write mechanics, and custom-status creation remain in their dependent decisions. The newly surfaced folder visibility details—navigation, direct links, and preference persistence—are tracked separately in [Define folder visibility behavior](05-define-folder-visibility-behavior.md).

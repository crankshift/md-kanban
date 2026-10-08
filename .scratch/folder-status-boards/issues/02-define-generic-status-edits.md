# Define generic status edits and drag behavior

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Parent: ../map.md
Blocked by: 01

## Question

Which Markdown documents may have their status changed through the board or issue tools, and what exactly does an edit change?

Settle the writable boundary beyond the legacy fixed-workflow adapter, preservation of frontmatter versus leading properties, inserting or clearing a missing status, handling duplicate/conflicting/non-scalar metadata, the spelling written when a column merges case variants, and the behavior of cancelled, failed, or stale drag operations. Decide the explicit action that introduces a first status without requiring a dummy issue, and follow the board-model decision's transient empty-column behavior without inventing completion or blocking semantics for authored status values.

Retain the established selected-folder and stale-write protections in ADR 0003. Identify the exact revision of ADR 0008's read-only boundary this design requires.

Prerequisite: [Define the folder and status board model](01-define-folder-and-status-board-model.md).

## Answer

The user accepted the following status-editing behavior on 2026-10-08:

- Explicit status changes apply to ordinary Markdown documents as well as issues; recognized legacy workflow metadata and numbered issue filenames are not prerequisites. Broader editing of ordinary documents remains separate.
- Change the existing status value in its current representation, including YAML frontmatter or a leading plain/bold property. Preserve unrelated content and formatting.
- If status is absent, insert it into existing frontmatter; otherwise insert a leading Status property beneath the title. A move writes the destination column's displayed spelling. Authored values remain unrestricted by built-in workflow enums.
- Duplicate, conflicting, or non-text status metadata prevents status dragging until corrected. Keep the file readable and show the reason; do not pick an occurrence or coerce a value.
- Dropping onto No status removes only the status property.
- Provide Add status on the board. An entered label creates an empty drop destination without creating a dummy issue. Follow the agreed reload-limited column lifetime unless a document uses the value.
- Retain the prior mouse, touch, and keyboard interaction, targeted-write preservation, expected-revision conflict checks, optimistic updates with rollback on failure, and cancellation/same-status no-op behavior. Case-only variants belong to the same status, so a drop within that status does not rewrite spelling.

Architectural context: [Allow authored status changes on Markdown documents](../../../docs/adr/0009-authored-markdown-status-changes.md) records the narrowed exception to ADR 0008's read-only generic workspace. This is an agreed target design; production implementation has not begun.

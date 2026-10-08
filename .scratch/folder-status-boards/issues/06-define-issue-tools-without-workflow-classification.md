# Define issue tools without workflow classification

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Parent: ../map.md
Blocked by: 03

## Question

Which documents can reopen full issue editing and commenting when issue creation no longer requires a recognized status, filename, or workflow?

An ordinary note and a newly created issue may have identical Markdown. Settle whether the user explicitly opens issue tools on any document, an authored marker or folder choice distinguishes issues, or some narrower rule preserves full editing of newly created issues. Status values must not determine issue identity or imply completion. Preserve the agreed ordinary-document status capability and distinguish any additional body-editing scope from that already settled boundary.

Use the chosen New issue format as the prerequisite. Include what happens to existing custom-status and legacy issues after removing fixed workflow validation, without silently assigning a new workflow or rewriting files.

Prerequisite: [Define issue creation with authored statuses](03-define-custom-status-issue-creation.md).

## Answer

On 2026-10-08 the user accepted optional Edit and Add comment actions for every Markdown document, without requiring special filenames, status values, or an authored issue marker. Reading remains the default and writes require an explicit action.

This deliberately expands the earlier status-only boundary for ordinary documents: newly created issues, ordinary notes, and legacy/custom-status files can reopen the same document tools without automatic issue classification. Issue remains a description of a document's purpose, not a schema that the app must infer or store.

Fixed implementation/wayfinding status enums must not gate editing, commenting, creation, repair, or status changes. Existing authored labels remain unchanged; do not rewrite files or assign workflows as a migration. Keep real metadata diagnostics and the agreed duplicate/conflicting/non-text status drag guards, but an unfamiliar status alone is not an error. Do not infer completion or dependency resolution from a status label.

Preserve explicit saves, targeted edits, expected revisions, draft guards, and write authorization. Generic editing should let an author correct ambiguous metadata deliberately rather than make structured status controls guess which occurrence is intended. The editor's presentation is part of prototype review, not a new mandatory Markdown convention.

Architectural context: [Make document editing independent of issue classification](../../../docs/adr/0010-document-tools-without-issue-classification.md). Shared vocabulary now calls these capabilities Document tools.

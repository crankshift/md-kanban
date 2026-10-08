# Design folder-scoped status boards

Labels: wayfinder:map
Status: resolved

## Destination

Reach a shared, documented design for discovering Markdown throughout the launch folder, folder-scoped status boards, restored status drag-and-drop, and issue creation with authored statuses. Validate the behavior with a throwaway interactive prototype before separate production implementation.

## Notes

- The user confirmed this destination on 2026-10-08: documented behavior and a prototype first, production implementation afterwards.
- Use wayfinder, grilling, and domain-modeling throughout; use prototype after the brainstorm. Record settled terminology in the root glossary and consequential architectural trade-offs in ADRs.
- Standing user requirements: remove folder-name-dependent discovery and built-in status vocabularies; discover statuses from Markdown in the selected folder scope; allow an invented status when creating an issue. Discuss status-free folders explicitly.
- Use the shared vocabulary in the [glossary](../../GLOSSARY.md); folder scope and status-board semantics are recorded in the resolved decision below.
- [ADR 0009](../../docs/adr/0009-authored-markdown-status-changes.md) records the status-write boundary, and [ADR 0010](../../docs/adr/0010-document-tools-without-issue-classification.md) extends explicit editing/comments to all documents. Both revise the earlier read-only boundary in [ADR 0008](../../docs/adr/0008-generic-markdown-workspace.md); production implementation follows prototype review.
- The [prototype brief](prototype-brief.md) links the canonical decisions and review scenarios. The user confirmed shared understanding with Q26, requested a project-based UI, and finally approved A after the cursor-following shadow refinement on 2026-10-08. [Try folder-scoped statuses and issue creation](issues/04-prototype-folder-status-behavior.md) records that final verdict and prototype capture; the initial standalone demo is superseded.
- For production implementation, use the [implementation prompt](implementation-prompt.md), which references the approved capture and gives the execution and validation scope.
- Use the [local Markdown wayfinding conventions](../../docs/agents/issue-tracker.md): child files carry Type, Status, and Blocked by; claim before working a child; resolve with an Answer and a link here. No triage labels belong to this map or its children.
- Charting records open questions without resolving them. Subsequent work resolves one child per session, using the live human exchange for grilling and prototype decisions.

## Decisions so far

- [Define the folder and status board model](issues/01-define-folder-and-status-board-model.md): recursive discovery, folder visibility, scope-local authored statuses, stable filtered columns, explicit missing/ambiguous groups, and card status dragging are agreed.
- [Define generic status edits and drag behavior](issues/02-define-generic-status-edits.md): explicit, format-preserving status changes extend to ordinary Markdown, with ambiguity guards, clearing via No status, and Add status for empty destinations.
- [Define issue creation with authored statuses](issues/03-define-custom-status-issue-creation.md): any chosen folder, new folders, editable suggested filenames, optional free-text status, and minimal Markdown replace workflow-bound creation.
- [Define folder visibility behavior](issues/05-define-folder-visibility-behavior.md): subtree hiding, explicit reading of hidden documents, URL view state, default visibility, and immediate creation of selectable empty folders are settled.
- [Define issue tools without workflow classification](issues/06-define-issue-tools-without-workflow-classification.md): optional editing/comments apply to every Markdown document, with no issue marker, fixed workflow, or status-based eligibility.
- [Try folder-scoped statuses and issue creation](issues/04-prototype-folder-status-behavior.md): A is selected as the project-based UI reference, including a cursor-following shadow card during dragging.

## Not yet specified

None. The design and selected prototype establish the route for separate production implementation.

## Out of scope

- Production implementation, package publication, and release changes. This map establishes and validates the design first.
- Automatic visibility memory across fresh launches or changing ports is deferred optional polish; the current design retains URL view state, as discussed in [Define folder visibility behavior](issues/05-define-folder-visibility-behavior.md).

# Organize the workspace around Markdown documents and folders

The workspace will discover Markdown documents independently of any author or agent's issue conventions, use folders for scope, and project optional properties into generic board views rather than require fixed workflows. We chose portability across changing conventions over the built-in implementation/wayfinding model in ADR 0002; document links and explicitly targeted dependencies remain distinct, and property values imply no completion or blocking semantics.

This supersedes ADR 0002 as the target product model. The user selected prototype A, the folder explorer with a reading pane, for the production transition on 2026-10-08. Files, generic Board, and global/local Map views are read-only. Existing issue editing, creation, comments, repair, and status writes remain optional capabilities under their original authorization and stale-write rules. React Flow supplies the canvas, D3-Force the Overview layout, and the approved Dagre integration the Directed layout.

[ADR 0009](0009-authored-markdown-status-changes.md) partially supersedes the read-only/status-write boundary for the next target: explicit authored status changes also apply to ordinary Markdown. That transition is agreed for the folder/status prototype and subsequent implementation; broader editing of ordinary documents remains separate.

[ADR 0010](0010-document-tools-without-issue-classification.md) then expands the agreed target to optional explicit Edit and Add comment actions for every Markdown document, without requiring automatic issue classification. Production implementation remains subsequent work.

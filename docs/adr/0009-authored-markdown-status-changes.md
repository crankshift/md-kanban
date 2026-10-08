# Allow authored status changes on Markdown documents

The read-only generic Board and fixed-workflow write adapter prevent changing statuses for ordinary Markdown and custom vocabularies. The target design permits explicit status changes on any in-boundary Markdown document with unambiguous editable metadata, preserving its representation, unrelated content, and the stale-write protections of ADR 0003. This chooses compatibility with authored files over requiring issue classification or a workflow schema; it partially supersedes ADR 0008's read-only/status-write restriction, while broader editing of ordinary documents remains separate.

The detailed decision is recorded in [Define generic status edits and drag behavior](../../.scratch/folder-status-boards/issues/02-define-generic-status-edits.md). The design is agreed; production implementation follows the folder/status prototype.

[ADR 0010](0010-document-tools-without-issue-classification.md) subsequently expands the ordinary-document boundary to optional explicit editing and comments. The targeted status-write rules in this decision remain applicable.

Implemented on `feat/folder-status-boards`: writable identity is a safely readable in-boundary Markdown file with an expected revision. Status parsing/targeted patches stay server-side, with separate system/authored identities and ambiguity guards. Collection visibility does not restrict explicit reading or authoring.

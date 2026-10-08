# Make document editing independent of issue classification

A minimal new issue and an ordinary note may have identical Markdown, so fixed statuses, filenames, or required markers cannot reliably decide which documents may be edited. The target design makes Edit and Add comment explicit optional actions for every in-boundary Markdown document, choosing consistent author control over automatic issue classification while retaining targeted writes, expected revisions, and draft protection. This expands the ordinary-document status-only boundary in ADR 0009 and the read-only boundary in ADR 0008; reading remains the default and unfamiliar authored statuses are not errors.

The detailed decision is recorded in [Define issue tools without workflow classification](../../.scratch/folder-status-boards/issues/06-define-issue-tools-without-workflow-classification.md). The design is agreed; production implementation follows prototype review.

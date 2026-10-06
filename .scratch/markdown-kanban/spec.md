# Markdown Kanban board

The functionality and stack choices below were agreed through a design interview. This document captures the agreed v1 scope.

Implementation is sequenced in [the implementation workflow](implementation-workflow.md), using a single `feat/md-kanban-v1` branch. Runs proceed without routine clarification questions and copy the next ticket's saved prompt to the clipboard after completing the current ticket.

## Agreed choices

- Develop mdboard as an open-source project under the MIT license at `https://github.com/crankshift/md-kanban`.
- Launch a local Node server and browser interface through a CLI.
- Accept an optional folder argument, defaulting to the launch directory. The intended published commands include `pnpx mdboard` and `pnpx mdboard ./`.
- Use React, TypeScript, and Vite for the interface, Node for local file access, and React Hook Form for structured editing. Use Zod where runtime validation is needed, particularly for parsed metadata and write requests.
- Build the interface with Chakra UI v3 ([ADR 0004](../../docs/adr/0004-chakra-ui-for-board-interface.md)). Keep navigation and view state in the URL with React Router and nuqs, file data and writes in TanStack Query, and drafts in their open editor, without app-owned React Context or a global store ([ADR 0005](../../docs/adr/0005-client-state-without-app-context.md)).
- Accept repository, tracker, feature, and issue directories as launch targets. Support ticket folders under `docs` as well as `.scratch`, recognizing both `issues/` and `tickets/` containers and directly selected issue folders.
- When a repository contains multiple ticket locations, include all discovered locations in the board. Show folder paths and provide location and feature filters.
- Use existing statuses as draggable columns rather than introduce a separate progress lifecycle.
- Support implementation issues and wayfinding issues in separate board views.
- Show dependencies as links and blocker badges.
- Provide a structured editor with a Markdown body for editing issues.
- Save editor changes explicitly; save status changes immediately when a card is dragged to another column. Show every write optimistically and roll it back with a visible error if it fails.
- Refresh issues when files change externally, while preserving unsaved drafts. Reject saves based on stale file contents and offer reload or draft recovery instead of silently overwriting another editor's changes.
- A draft exists only while its editor is open. Closing an editor with unsaved changes asks for confirmation. On a stale save, show which fields changed on disk and in the draft, and offer to discard the draft or reapply its changed fields onto the latest file.
- Keep dependency enforcement advisory. Calculate unresolved dependencies for wayfinding issues using their `resolved` state; show implementation dependencies without inferring completion from triage readiness.
- Include issue creation, title/status/dependency editing, Markdown body editing with preview, and adding comments in v1. Restrict dependency selection to the same feature or effort initially.
- Preserve existing formatting and unknown Markdown sections when changing structured fields. Deliberate body edits change only the body selected by the user.
- Defer deletion, rich-text editing, and custom labels.
- Surface issue candidates with missing or unfamiliar statuses, malformed metadata, or an ambiguous workflow in a Needs attention panel. Show the path and reason, allow reading the document, and do not guess or automatically rewrite its metadata. Let the user fix it explicitly by choosing a status, choosing or removing a Type line, or editing the file's Markdown; only the chosen lines change.
- Sort cards by feature and then ticket number. Moving within a column does not persist manual priority ordering.
- Use compact cards showing number, title, feature, and dependency indicators. Open issue details, editing, and supporting documents in a dialog over the board so the columns never shrink; following links inside it keeps a Back history.
- Navigate with a sidebar listing workflows, Needs attention, locations with their features or efforts, and supporting documents. The sidebar collapses to an icon rail. Offer a list view grouped by status as an alternative to columns, and a command palette for jumping to any issue or document.
- Use autocomplete pickers for every value selection, never native select menus.
- Include text search across issue titles and bodies, in combination with location and feature filters.
- Include read-only supporting-document browsing for specifications, maps, and architectural decisions. Discover repository ADRs under `docs/adr` when launching from the repository root, and render their Markdown in the detail dialog.
- Follow links from issues and specifications to supporting documents within the selected folder. A launch restricted to an issue folder exposes only supporting documents within that folder.

## Acceptance criteria

- Launching without a folder argument and launching with `./` select the same directory. An explicit relative path is resolved from the launch directory.
- Repository-root discovery includes supported issue containers under `.scratch` and `docs`. Passing an issue folder directly also works. Multiple locations do not duplicate the same issue.
- Specifications, maps, ADRs, and ordinary documentation do not appear as issue cards merely because they are Markdown files. ADR metadata, including a `Status:` field, never causes an ADR to appear as a ticket or a Needs attention entry.
- Plain metadata keys and bold metadata keys both parse correctly. Dependencies containing ticket numbers plus titles and the supported no-dependency text are handled without discarding their original representation.
- Ticket numbers are scoped to their feature or effort and location; two issues numbered `01` in different features remain distinct.
- Implementation and wayfinding views use their own status columns. Dragging to another column changes only the relevant status metadata and preserves unrelated content.
- A failed status save is visibly reported and does not leave the board showing an unsaved status as if it were persisted.
- Wayfinding dependencies become resolved when their referenced issues are `resolved`. Implementation readiness does not imply completion. Missing or ambiguous dependency references are visible rather than silently dropped, and blockers do not prohibit status changes.
- Clicking a dependency opens the referenced issue when the reference can be resolved.
- A user can create an issue in a selected feature or effort, edit its supported fields and body, preview Markdown, and append a comment under `## Comments`. New issue numbering follows the selected container's conventions and does not overwrite existing files.
- Structured edits preserve unknown sections, acceptance checkboxes, comments, and formatting outside the intended changes. Body editing is distinct from the structured metadata fields and comments.
- External file changes refresh untouched issues. Changes to a file with an unsaved draft preserve the draft and surface the conflict. Stale writes are rejected for editor saves, status moves, dependency changes, and comment additions.
- Needs attention entries retain the original file contents and provide a readable diagnostic. They are not silently assigned a status or workflow. An explicit fix rewrites only the chosen metadata lines, rejects stale writes, and moves the issue onto its board once the server no longer reports a diagnostic.
- Card sorting, text search, and combined feature/location filters work across all discovered locations.
- A repository-root launch exposes `docs/adr` in the supporting-document browser. Selecting an ADR renders its Markdown in the detail dialog without editing controls.
- Links from issues or specifications open available supporting documents inside the selected folder; a missing or out-of-scope document is clearly identified as unavailable.

## V1 boundaries

- Markdown files remain the source of truth and changes are written back to those files.
- Dependencies are selected within the same feature or effort; cross-feature dependency editing is deferred.
- Existing triage statuses do not track implementation completion. The board introduces no additional execution lifecycle in v1.
- Custom labels, manual priority ordering, rich-text editing, and deletion are deferred.
- Supporting documents are read-only in v1; ADR creation and editing are deferred.
- Launching the packaged app requires a local process. Registry publication is a separate release action; the CLI examples describe intended usage after publication.

## Compatibility facts

- The repository tracker groups specifications and issues under `.scratch/<feature-or-effort>/`, with issues inside `issues/`.
- Implementation triage statuses are `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. They do not encode implementation completion.
- Wayfinding statuses are `open`, `claimed`, and `resolved`.
- Existing Matt Pocock skill templates can emit bold metadata keys such as `**Status:**` and dependency references containing both numbers and titles. The reader and editor must account for these forms.
- Specifications, maps, and ADRs are supporting documents, distinct from issue cards. This repository uses the single-context ADR layout `docs/adr/`.
- The installed `to-tickets` skill and local tracker seed use `.scratch`; the installed `to-spec` skill delegates publication to the configured tracker. This does not establish whether the latest upstream defaults have changed.

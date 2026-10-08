# Define issue creation with authored statuses

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Parent: ../map.md
Blocked by: 01, 02

## Question

How does New issue create a Markdown file in a folder without requiring an existing recognized workflow, and how does the user choose or invent its status?

Settle creation targets, empty folders, filename and metadata conventions, suggestions versus free input, optional status and first-status behavior, and compatibility with existing numbered issues. Determine which legacy required properties and workflow assumptions remain justified, using the agreed folder-board and generic status-write decisions as prerequisites.

Prerequisites: [Define the folder and status board model](01-define-folder-and-status-board-model.md) and [Define generic status edits and drag behavior](02-define-generic-status-edits.md).

## Answer

The user accepted the following creation behavior on 2026-10-08:

- Create an issue in any chosen folder inside the launch boundary, including an empty folder. Default to the currently selected folder and allow choosing another; no existing recognized issue or workflow is required.
- Users can create new folders too. The creation flow must support choosing such a folder as its target. Placement and navigation/lifetime details of that folder action are settled with [Define folder visibility behavior](05-define-folder-visibility-behavior.md) and reviewed in the prototype.
- Suggest an editable filename from the title, such as fix-login.md. Continue a clear existing numbering pattern, such as 08-fix-login.md, without making numbering mandatory. Never overwrite an existing file.
- The Status input accepts an authored label and suggests values from the target folder scope. It is not constrained by built-in workflow choices.
- Status is optional and defaults to No status. Starting creation from a specific status column prefills its label; the user can change or clear it.
- Generate minimal Markdown: a title, optional body, and optional Status. Do not automatically require or insert Type, workflow, or Blocked by fields.

How newly created and legacy issues reopen full editing/comment tools without workflow-based classification is the separate decision [Define issue tools without workflow classification](06-define-issue-tools-without-workflow-classification.md).

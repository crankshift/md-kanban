# 05: Edit issues and append comments

Status: ready-for-agent
Blocked by: 04

## Outcome

A user can edit an issue's title, status, dependencies, and Markdown body, preview the body, and append comments without damaging unrelated content.

## Scope

- Add a structured React Hook Form editor with runtime validation where needed, plus a Markdown textarea and preview.
- Separate structured metadata, editable body, and existing comments so one operation does not inadvertently regenerate the whole document.
- Select dependencies only from the same feature/effort and preserve supported dependency representation when unchanged.
- Save editor changes explicitly through the shared revision-checked write boundary. Append new comments under `## Comments`, creating that heading when needed.
- Preserve unsaved drafts on failure or conflict and provide reload/draft-recovery actions. Do not silently discard drafts when navigating between issues.
- Keep Needs attention documents readable without introducing a guessed structured editing workflow for unsupported files.

## Acceptance criteria

- Title, status, dependency, body, and comment operations each persist their intended change while preserving unrelated sections and formatting.
- Existing comments and acceptance checkboxes survive metadata edits; adding a comment does not replace prior comments or the body.
- Validation failures alter no file and remain clear in the editor.
- Every mutation detects stale file revisions and retains the user's draft when rejected.
- Body preview follows the safe rendering behavior introduced in issue 03.
- Relevant disk/API/form integration checks, type checking, and production build pass.

## Comments

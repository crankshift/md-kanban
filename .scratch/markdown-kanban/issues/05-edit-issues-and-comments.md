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

### Implementation result — 2026-10-06

- Added a structured React Hook Form editor for title, workflow status, same-feature/location dependencies, and the Markdown body. Save issue persists only changed fields explicitly; card/detail Change status still saves immediately. Dependency options span the effort's containers, exclude self/ambiguous references, and retain supported number/title/no-dependency representation when unchanged. Clear dependencies deliberately removes unresolved references. Preview reuses the same safe Markdown renderer as details: HTML is skipped, unsafe URLs are sanitized, and checkboxes remain disabled.
- Separated leading metadata, the editable body, and existing Comments with preserved character ranges in `src/server/document.ts`. Body changes affect only the selected body; title/status/dependency changes retain surrounding style, BOM, whitespace, LF/CRLF, unknown sections, checkboxes, and comments. Appending a comment creates `## Comments` when needed, retains prior comments/body, and inserts before any later top-level section rather than extending that unrelated section. Fixed issue-heading lookup so numbered body examples cannot redefine an unnumbered issue title/number.
- Added strict Zod-validated `POST /api/edit` (`{ path, expectedRevision, changes }`) and `POST /api/comment` (`{ path, expectedRevision, comment }`). Both use the established session/origin/path protections and `writer.update`; every title/status/dependency/body/comment mutation, including no-op requests, checks the loaded revision. Editor/comment requests are limited to 1 MiB, with body/comment character limits of 500,000/100,000. Invalid requests, wrong-workflow statuses, self/cross-scope/ambiguous dependencies, invalid document boundaries, and stale revisions leave files intact. Shared client persistence confirms returned disk data and refreshes after rejection or a lost response.
- Drafts retain original values and revisions per issue across navigation, Close/Escape, failed saves, and reload. Field saves preserve unsent comments; comment saves preserve unsaved fields. Reload issues keeps drafts; explicit Recover draft on latest version overlays changed fields onto loaded disk data for review. Discard is explicit. Removed or newly unsupported issues retain copyable drafts and a reload path. Needs attention documents remain readable without structured controls. A stale comment retry after a lost response cannot duplicate the comment; recovery tells the user to inspect existing comments first.
- Updated README and contribution guidance for form use, range preservation, API shapes, validation, draft recovery, and verification. Added `react-hook-form` 7.89.0 using the existing pnpm store. Context7 was unavailable and the documentation website returned 403; consulted official React Hook Form [useForm](https://raw.githubusercontent.com/react-hook-form/documentation/master/src/content/docs/useform.mdx), [formState](https://raw.githubusercontent.com/react-hook-form/documentation/master/src/content/docs/useform/formstate.mdx), and [reset](https://raw.githubusercontent.com/react-hook-form/documentation/master/src/content/docs/useform/reset.mdx) sources. Retained the existing React/TypeScript/Vite/Node/Zod and Markdown stack.
- Verification: final `pnpm check` passed strict type checking, production build, and all 46 tests, including CLI and offline installed-tarball checks. Type checking and individual API/form files ran during development. New real disk/API checks cover targeted preservation, both newline conventions, missing dependency metadata, unchanged dependency representation, scoped selection, fenced heading examples, separate body/comments, comment-section creation/repeated append, validation/no writes, all stale mutation types, and concurrent edit/comment saves. Real HTTP/disk React/jsdom checks cover explicit saves, safe preview, navigation drafts, form statuses/dependencies, invalid titles, conflicts/recovery, read-only disk failures, lost responses and failed refreshes, before-unload protection, explicit discard, and removed/unsupported draft recovery. Whitespace checks passed; fixtures and committed paths are portable and public-safe. Loopback/package checks ran outside the restricted sandbox as in prior tickets. UI verification used React interactions; no separate visual browser verification was performed.
- Code review: Standards found no documented breaches and one optional duplication in the client save lifecycle; consolidated status/editor/comment saves into `persistIssue`, then reran checks. Standards and Spec reviewers confirmed no remaining findings and no deferred scope.
- Limitations: drafts live in this tab's memory, so save or copy before leaving; the browser's before-unload warning is advisory. Explicit recovery of a changed body replaces the whole editable body and requires manual reconciliation of overlapping external body edits. Comments use `###` or deeper headings; new level-one/two headings and unclosed fences are rejected to preserve sections. Duplicate Comments sections or unclosed fences disable the form and direct users to Markdown. Sections after Comments remain readable/preserved, outside the editable body. The existing writer's external-editor final-check race, inode/extended-metadata, and abandoned-lock limitations remain as documented in ticket 04. The production build passes with a non-blocking ~514 kB minified bundle warning; bundle splitting was not added to this ticket.
- Handoff for ticket 06: creation remains unimplemented. Reuse form validation, `SafeMarkdown`, scoped dependency resolution, returned issue/revision updates, and the same session/origin protections. Creation needs a separate exclusive allocation/create operation; `writer.update` authorizes existing discovered issues and must not be bypassed with overwriting writes. Existing issue drafts must survive opening/closing a creation flow. File watching remains ticket 07, supporting-document navigation ticket 08. Triage remains `ready-for-agent`; completion is recorded only by the workflow checkbox.

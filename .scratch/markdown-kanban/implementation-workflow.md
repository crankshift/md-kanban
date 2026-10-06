# Implementation workflow

The design interview is complete and the user has authorized proceeding without clarification questions. Implement the agreed specification, using conservative judgment for routine technical decisions and current official documentation for library facts.

## One branch

Use `feat/md-kanban-v1` for every issue below. Stay in the existing checkout; do not create per-issue branches, additional worktrees, or per-issue pull requests. If the branch is not checked out, inspect the working tree before switching so existing work is preserved.

## Sequence

Issues 10–13 were added after a UI redesign, and issue 14 renames the package to `mdkanban` for registry publication. All of them run before 09, which verifies the finished v1. Work through the list in the order shown. Issue 15, publishing to npm, needs a human and is not part of this sequence.

The checkboxes below track implementation completion for this effort. They do not introduce a new ticket status or product lifecycle; the issues retain the repository's triage vocabulary.

- [x] 01 — Launch the packaged local web app
- [x] 02 — Discover tickets and render read-only boards
- [x] 03 — Read issue details, dependencies, and search results
- [x] 04 — Persist status changes without overwriting other edits
- [x] 05 — Edit issues and append comments
- [x] 06 — Create issues in an existing feature or effort
- [x] 07 — Refresh external changes while protecting drafts
- [x] 08 — Browse supporting documents and ADRs
- [x] 10 — Move client state into the URL, query cache, and editor
- [x] 11 — Rebuild the interface with Chakra UI as a navigator board
- [x] 12 — Drag cards between status columns
- [x] 13 — Fix unrecognized issue candidates from Needs attention
- [ ] 14 — Rename the package and product to mdkanban
- [ ] 09 — Verify the complete v1 and prepare the local release candidate

## Each implementation run

1. Read `AGENTS.md`, its referenced instructions, `GLOSSARY.md`, the relevant ADRs, the specification, this workflow, and the assigned issue. Review prior issue comments for handoff context.
2. Check that prerequisite issues are complete in this checklist. Implement only the assigned issue, resolving routine choices without asking the user questions. Preserve unrelated changes.
3. Complete its acceptance criteria and run the relevant meaningful checks. Do not expand the product scope to deferred features.
4. Append an implementation result under the issue's `## Comments`: resulting behavior, checks and outcomes, limitations, and useful context for the next issue. From issue 10 on, add the user-visible changes to the `Unreleased` section of `CHANGELOG.md`. Check off this issue here only when its required work is complete.
5. Commit the issue's implementation, documentation, and completion record on `feat/md-kanban-v1`. Keep the commit focused; do not stage unrelated work. Do not push, merge, publish to npm, or deploy unless separately requested.
6. Read the next unchecked issue and its saved prompt at `.scratch/markdown-kanban/implementation-prompt-<NN>.md`. Copy that prompt to the user's clipboard, then report the completed issue, validation, and next issue. On macOS use `pbcopy` with the prompt file as stdin and verify the clipboard contents when possible. On another platform use an available clipboard integration; if clipboard access is unavailable, provide the saved prompt's path and plainly report the limitation.
7. After issue 09, there is no next issue prompt; report that the v1 implementation sequence is complete instead.

## Hard blockers

Do not ask routine questions or seek repeated confirmation for agreed work. If an external dependency, unavailable access, or tool restriction makes completion impossible, document the exact blocker and what was attempted; do not mark the issue complete or advance the clipboard to a supposedly ready next issue. Never overwrite existing work to get around a blocker.

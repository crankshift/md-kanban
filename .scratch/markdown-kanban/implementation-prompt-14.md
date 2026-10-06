Implement md-kanban ticket 14 in this repository:

`.scratch/markdown-kanban/issues/14-rename-to-mdboard.md`

Read `AGENTS.md` and its referenced instructions, `GLOSSARY.md`, relevant ADRs under `docs/adr/` (especially ADR 0006), `.scratch/markdown-kanban/spec.md`, `.scratch/markdown-kanban/implementation-workflow.md`, the assigned ticket, and prior tickets' implementation comments.

Use the existing checkout and the single feature branch `feat/md-kanban-v1` for the entire effort. Do not create per-ticket branches, worktrees, or PRs. The design is agreed: proceed without asking the user clarification questions, and resolve routine decisions using the specification, prior implementation, and current official documentation. Preserve unrelated work.

Check the workflow's completion checklist before starting. Complete only ticket 14 and all its acceptance criteria. This is a rename: do not change behavior beyond the names the ticket lists. Keep the GitHub repository name and URLs as `md-kanban`, and leave earlier tickets and saved prompts unchanged. Do not add deferred product features.

Run the meaningful checks appropriate to this change, including type checking, the production build, the tests, and a `pnpm pack` inspection, and update documentation affected by the implementation. Use portable public-safe fixtures and paths. Record resulting behavior, verification outcomes, limitations, and next-ticket context under the ticket's `## Comments`.

When all required work is complete, check off this ticket in the implementation workflow and commit its focused changes on `feat/md-kanban-v1`. Do not invent a ticket completion status. Do not push remote changes, merge, deploy, or publish a package.

Then read the next unchecked ticket and copy its saved implementation prompt to the clipboard without asking the user. Normally this is `.scratch/markdown-kanban/implementation-prompt-09.md`. On macOS use `pbcopy` with the prompt file as stdin and verify the clipboard when possible. If clipboard access is unavailable, report the limitation and provide the saved prompt's path.

Finish with a concise report of the implementation, verification, and clipboard handoff (or final sequence completion). If a genuine hard blocker prevents completion, document it clearly, do not claim the ticket is complete, and do not advance to a supposedly ready next ticket.

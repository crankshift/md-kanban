Implement md-kanban ticket 09 in this repository:

`.scratch/markdown-kanban/issues/09-verify-v1-release-candidate.md`

Read `AGENTS.md` and its referenced instructions, `GLOSSARY.md`, relevant ADRs under `docs/adr/`, `.scratch/markdown-kanban/spec.md`, `.scratch/markdown-kanban/implementation-workflow.md`, the assigned ticket, and prior tickets' implementation comments.

Use the existing checkout and the single feature branch `feat/md-kanban-v1` for the entire effort. Do not create per-ticket branches, worktrees, or PRs. The design is agreed: proceed without asking the user clarification questions, and resolve routine decisions using the specification, prior implementation, and current official documentation. Preserve unrelated work.

Check the workflow's completion checklist before starting. Complete only ticket 09 and all its acceptance criteria. Reuse the established stack and boundaries; keep Markdown as the source of truth, preserve unrelated content, and apply stale-write protection to every mutation this ticket introduces. Do not add deferred product features.

Run the meaningful checks appropriate to this change, including type checking and the production build, and update documentation affected by the implementation. Use portable public-safe fixtures and paths. Record resulting behavior, verification outcomes, limitations, and next-ticket context under the ticket's `## Comments`.

When all required work is complete, check off this ticket in the implementation workflow and commit its focused changes on `feat/md-kanban-v1`. Do not invent a ticket completion status. Do not push remote changes, merge, deploy, or publish a package.

This is the final ticket in the agreed v1 sequence. After validation and the completion commit, report that the implementation sequence is complete; there is no next prompt to copy. Do not publish, push, deploy, or merge.

Finish with a concise report of the implementation, verification, and clipboard handoff (or final sequence completion). If a genuine hard blocker prevents completion, document it clearly, do not claim the ticket is complete, and do not advance to a supposedly ready next ticket.

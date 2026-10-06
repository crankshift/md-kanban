Implement md-kanban ticket 16 in this repository:

`.scratch/markdown-kanban/issues/16-rename-to-mdboard.md`

Read `AGENTS.md` and its referenced instructions, `GLOSSARY.md`, relevant ADRs under `docs/adr/` (especially ADR 0006), `.scratch/markdown-kanban/spec.md`, `.scratch/markdown-kanban/implementation-workflow.md`, the assigned ticket, and the implementation comments on tickets 14, 09, and 15.

Unlike tickets 01–14, this ticket runs on its own branch, `feat/rename-to-mdboard`, created from an up-to-date `main`. Do not create worktrees. The design is agreed: proceed without asking the user clarification questions, and resolve routine decisions using the specification, prior implementation, and current official documentation. Preserve unrelated work.

Complete only ticket 16 and all its acceptance criteria. This is a rename: do not change behavior beyond the names the ticket lists. Keep the GitHub repository name and URLs as `md-kanban`, and leave earlier tickets and saved prompts unchanged. Do not add deferred product features.

Run the meaningful checks appropriate to this change, including type checking, the production build, the tests, a `pnpm pack` inspection, an install of the tarball outside the checkout, and `npm publish --dry-run`. Update documentation affected by the implementation. Use portable public-safe fixtures and paths. Record resulting behavior, verification outcomes, limitations, and next-ticket context under the ticket's `## Comments`.

When all required work is complete, check off this ticket in the implementation workflow and commit its focused changes on `feat/rename-to-mdboard`. Do not invent a ticket completion status. Ask the user before pushing the branch, opening the pull request, and squash-merging it into `main`. Do not tag, publish, or deploy.

Finish with a concise report of the implementation and verification, and hand off to ticket 15: tagging `v0.1.0` and publishing `mdboard` need the user.

Implement the first md-kanban ticket in this repository:

`.scratch/markdown-kanban/issues/01-launch-local-app.md`

Work on the single feature branch `feat/md-kanban-v1` for this and every subsequent ticket. Read and follow `.scratch/markdown-kanban/implementation-workflow.md`. Do not create additional branches, worktrees, or per-ticket PRs. Proceed without asking the user clarification questions; resolve routine decisions from the agreed documents and current official documentation.

Start by reading `AGENTS.md` and the referenced tracker/domain instructions, then `GLOSSARY.md`, the ADRs under `docs/adr/`, the agreed specification at `.scratch/markdown-kanban/spec.md`, and ticket 01. The product decisions are agreed; proceed with implementation and resolve routine technical choices yourself. Consult current official documentation for dependency and runtime compatibility.

Deliver a working CLI -> local Node server -> React browser app slice, packaged so it works from a caller-selected folder outside the source checkout. Use React, TypeScript, Vite, Node, and pnpm. Introduce React Hook Form and Zod only where this ticket needs them.

The important boundaries are: optional folder defaults to the caller's cwd; invalid folders fail clearly; the server listens on loopback; frontend assets load from the installed package; browser opening has a `--no-open` option and a manual fallback; shutdown is clean. Follow the ticket's full scope and acceptance criteria.

Run meaningful automated checks, type checking, and a production build. Verify a packed-package installation from a temporary directory against a separate temporary folder, rather than relying solely on the development server. Update user-facing setup instructions with commands that actually work. Keep all committed paths and fixtures portable and public-safe.

Complete only ticket 01. Ticket discovery and the rest of the board functionality follow later. Do not publish to npm, deploy, or push remote changes as part of this task.

Append implementation and verification results under the ticket's `## Comments`, using existing tracker vocabulary rather than inventing a completion status. After all required checks pass, check off ticket 01 in the implementation workflow and commit its focused changes on `feat/md-kanban-v1`.

Then copy the saved prompt for the next unchecked ticket to the clipboard without asking the user. Normally this is `.scratch/markdown-kanban/implementation-prompt-02.md`; on macOS use `pbcopy` with that file as stdin and verify the clipboard when possible. Follow the workflow's fallback if clipboard access is unavailable. Finish with a concise report of what changed, how it was verified, and which next-ticket prompt was copied.

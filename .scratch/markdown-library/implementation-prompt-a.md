Implement variant A as mdboard's production generic Markdown workspace in `/Users/crankshift/khmara/projects/md-kanban-board`.

The user selected A and authorized this implementation handoff. Complete issue `.scratch/markdown-library/issues/02-implement-variant-a.md` end to end on a single implementation branch, including validation and a working local preview. Resolve routine technical choices from the agreed scope and current code.

## One branch and source material

Use exactly one implementation branch, `feat/generic-markdown-workspace`, based on production `main`, in the existing checkout. Inspect the working tree first and preserve unrelated work. Reuse that branch if it already exists. Keep all phases and focused commits on it; do not create per-issue branches, additional worktrees, or per-phase pull requests. Do not push, merge, publish, deploy, or change the release version as part of this task.

The existing `prototype/markdown-workspace-2026-10-07` branch is a primary-source archive, not the implementation base. Read its immutable code capture `477054d`: `src/client/workspace-prototype/WorkspacePrototype.tsx` (VariantA), `DocumentMap.tsx`, `prototype.css`, `README.md`, and `scripts/markdown-workspace-prototype.mjs`. It includes graph readability commit `337d592` and hover fix `4431b92`. Use `git show <ref>:<path>` to inspect files without switching branches. The user-approved design records and issue 02 are on the archive branch; read them there if absent from main.

Read the active `AGENTS.md` and its referenced agent docs, the agreed spec `.scratch/markdown-library/spec.md`, issue 02, `GLOSSARY.md`, and ADRs 0001, 0003, 0004, 0005, and 0008 before changing production code. Carry the approved spec, issue/prompt, glossary changes, and ADR 0008/0002 transition into the implementation branch, merging with current main's documentation. Preserve the complete prototype on its archive branch. Rewrite A into real modules; do not merge/cherry-pick the entire prototype or ship its preview scaffolding.

## Implement the agreed scope

Issue 02 is the requirements and acceptance source of truth. Deliver its complete document collection, optional properties, generic board, A interface/reader, live updates, and graph behavior rather than stopping after one slice.

The product's core is Markdown documents, folders, and explicit relationships. Discover all Markdown in `docs/` and `.scratch/` recursively, and support direct folder launches within their selected boundary. Membership is independent of numbering, status, issue containers, or an author/agent's workflow. Show filenames/paths, title/body search, folder scope, metadata, and read/unavailable states.

Use A's folder tree, file results, and reading pane with Files/Board/Map views. Reuse the existing React/Chakra/router/query stack and safe Markdown renderer. Optional YAML frontmatter and leading plain/bold properties support arbitrary keys and values; preserve conflicts visibly. Board groups by any property or physical folder using values present in files and a missing-value group. No status-definition filename, fixed vocabulary, or inferred lifecycle is required.

Include both global and local maps, with Overview/Directed/Folders presentations. React Flow supplies the canvas, D3-Force the Overview layout, and the approved `@dagrejs/dagre` integration the Directed layout. Keep links, backlinks, and explicitly targeted dependencies distinct; preserve original directions when combining reciprocal display strokes. Local reading separates incoming, outgoing, and two-way links. Focus/hover quiets unrelated connections, All connections restores them, and unlinked files stay discoverable.

Preserve React Flow's measured node geometry through controlled-node updates. The prototype's hover regression was caused by replacing nodes without their measured dimensions, which made React Flow hide/re-measure them and trigger another mouse leave/enter. Treat `4431b92` as behavioral evidence; implement the production fix cleanly and regression-test the behavior rather than adding hover delays or merely suppressing diagnostics.

This milestone's generic views are read-only. Retain current supported issue editing, comments, creation, and status operations as optional capabilities where existing write APIs permit them; those conventions must not control the document index or generic UI. Preserve authentication, access boundaries, targeted writes, stale detection, draft guards, and recovery. Generic editing or arbitrary status writes require a separate design and are outside this implementation.

## Documentation and validation

Use the find-docs skill/current Context7 CLI for library-specific work: resolve with `npx ctx7@latest library`, then fetch focused docs with `npx ctx7@latest docs`, outside the default sandbox, following the active repo instructions. Verify package releases and respect pnpm's existing maturity policy. Add only dependencies required by the implementation; server-side parsers must be available in the installed runtime, while browser/build packages follow the repo's packaging boundary.

Build meaningful portable disk/API/UI integration coverage for issue 02, including metadata-free and unconventional documents, safe boundaries, grouping, links, live changes, and retained write/draft contracts. Update tests whose old workflow-first navigation is intentionally superseded. Check the real hover regression with three temporary files (A links to B, C links to B, A selected, pointer resting on C), at centers/borders and across refresh, plus the real UI in every map layout.

Run the project's type checking, production build, relevant tests, final full checks, and packed-package verification. Exercise A in a real browser with keyboard, light/dark modes, responsive folder navigation, reading/backlinks/fragments, generic Board, global/local maps, and supported editing using disposable fixtures. Use `/Users/crankshift/khmara/git-docs/invest` only for a read-only discovery/reading smoke test; never commit its private contents or hardcode its counts.

Completion requires the complete accepted behavior, passing required checks, a runnable packed production app, and no preview server, losing variants, floating switcher, state inspector, fixture data, or prototype entry-point gates in production. Update Unreleased CHANGELOG and user/contributor docs; append results, checks, limitations, and the approved A verdict to the issue/spec records. Commit the implementation on the single branch, leave the production preview available, and report the branch, commits, validation, preview URL, and any concrete remaining limitations. Stop after this feature; release/publication work is not assigned.

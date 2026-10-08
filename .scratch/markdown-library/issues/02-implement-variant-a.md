# 02: Implement variant A as the generic Markdown workspace

Status: ready-for-agent

## Outcome

mdboard opens a folder-oriented Markdown workspace using approved variant A: folder tree, file results, and a reading pane, with generic Board and Map views. Discovery and navigation work independently of any author or agent's issue conventions.

## Primary sources

- [Specification](../spec.md) and [implementation prompt](../implementation-prompt-a.md).
- Prototype branch: `prototype/markdown-workspace-2026-10-07`.
- Immutable code capture: `477054d`, which includes A, the graph readability iteration `337d592`, and hover fix `4431b92`.
- `src/client/workspace-prototype/WorkspacePrototype.tsx` (`VariantA`), `DocumentMap.tsx`, `prototype.css`, and `README.md` at that capture.
- `scripts/markdown-workspace-prototype.mjs` demonstrates the settled data model; rewrite it with production read/access/error handling rather than promote the preview server.
- ADR 0008 supersedes ADR 0002 as the target product model. ADRs 0001, 0003, 0004, and 0005 still apply.

## Requirements

### Document collection

- Recursively list every `.md` and `.markdown` file under `docs/` and `.scratch/` for a repository launch. Direct folder launches expose their Markdown descendants within the selected boundary. Preserve supported launch paths and avoid expanding access to parents.
- Include nested folders, drafts, archives, ADRs, agent guidance, specs, maps, ordinary notes, and issue files even when a folder contains no recognized issues. Folder names, issue numbers, statuses, and creator conventions do not determine membership.
- Preserve filesystem access boundaries, repository/dependency-internal exclusions, symlink protections, and the 2 MiB preview cap. Listed unreadable/oversized Markdown files retain their paths and an explanation. Report inaccessible directories instead of silently hiding an access problem.
- Identify documents by normalized selected-folder-relative path. Search filenames, titles, and Markdown text. Folder scope includes descendants.
- Refresh discovery, properties, links, open files, and maps after external edits, creation, renames, deletion, and atomic replacement without losing navigation or drafts.

### Optional properties and generic board

- Support optional YAML frontmatter and a conservative leading `Key: value` block, including existing bold-key forms. Preserve raw Markdown and all property occurrences. Report malformed/duplicate/conflicting metadata without assigning a guessed value or workflow.
- Accept arbitrary property names and literal values. Body prose and fenced examples are not leading metadata. Unknown Status/Type values are ordinary values, not invalid issues.
- Board groups the filtered collection by a chosen property or physical folder. Discover columns from actual values and provide a missing-value group; distinguish missing values from an author's literal value matching its display label. Represent conflicts explicitly, following the prototype's composite-value behavior rather than picking one occurrence.
- Folder grouping and an authored property named Folder have separate identities. Do not require a status-definition file, numbered filenames, `issues/` folders, mandatory frontmatter, or fixed workflows. Column order does not imply progress or completion.
- The generic board is read-only in this milestone. Generic document editing, arbitrary status writes, and new workflow/schema authoring are deferred.

### Interface and reading

- Implement A's structure and density using the existing Chakra theme, typography, light/dark modes, searchable pickers, responsive layouts, and keyboard access. Use folder scopes rather than Feature/Effort filters as the primary navigation.
- Provide Files, Board, and Map views, a persistent reading pane, file paths and optional metadata, outgoing links and backlinks, and clear empty/unavailable states.
- Keep navigation, search, property filters, grouping, map layout/scope, and the open file in the URL. Use the existing query cache for disk data and existing editor forms for drafts, following ADR 0005.
- Reuse safe Markdown rendering, relative-link and fragment navigation, Back/history, and existing access checks. Preserve reading of allowed in-boundary Markdown targets outside automatic discovery; their availability must not expand the access boundary or silently invent graph nodes.
- Keep currently supported issue editing, comments, creation, and immediate status changes reachable as optional capabilities where the existing write contracts permit them. Their parser and fixed vocabularies must not govern generic visibility, grouping, diagnostics, or navigation. Preserve authentication, stale-write checks, targeted file edits, draft guards, and recovery. Do not broaden write authorization to ordinary documents.

### Maps

- Support both global and one-hop local maps in this release. Keep unlinked files discoverable. Use real Markdown links, including reference links, and explicit file targets from the selected dependency property; ignore code examples and preserve link diagnostics.
- Numeric dependency references remain metadata unless an explicit target is established. Folder membership, file numbering, and status values imply neither dependency nor completion.
- Keep Overview, Directed, and Folders presentations from the refined prototype. Use React Flow for the canvas, D3-Force for Overview, and the user-approved Dagre integration for Directed. Folder/local layouts use their own coordinates. Layout engines are presentation tools rather than workflow models.
- Use quiet straight boundary-to-boundary links, combined reciprocal display strokes with original direction retained, focus highlighting, and an All connections option. A selected file's local map separates incoming, outgoing, and two-way connections; branches must not falsely suggest chains between unrelated neighbors.
- Preserve measured node geometry during controlled-node updates and use stable handlers. Hovering a stationary card must not hide/re-measure it repeatedly, flicker edges, move cards, or change selection. Check both card centers and borders, including across live refresh.

## Acceptance and delivery

- Portable fixtures cover repository and direct-folder discovery, metadata-free files, arbitrary properties/statuses, conflicts, missing/empty values, links/fragments, explicit dependencies, unreadable/oversized files, symlinks, and scope boundaries.
- Meaningful API/UI coverage verifies generic grouping/filtering/navigation and live updates while retaining existing write-preservation, auth, stale-write, and draft/recovery coverage. Update assertions tied to intentionally replaced workflow-first navigation.
- The hover regression uses A → B and C → B with A selected; hovering C stays visible and stable at center/border positions. Verify it in a real browser and cover dimension retention through the appropriate integration seam.
- Type checking, production build, relevant tests and final full checks pass. Verify real A journeys in light/dark modes, keyboard navigation, narrow layout, global/local maps, and supported editing using disposable fixtures. The user's `invest` folder is a read-only smoke-test target; its current file count is not a hardcoded test expectation.
- The packed app runs outside the checkout, contains production assets and required runtime parsers, and contains no preview server, fixture data, losing variants, floating switcher, state inspector, or development gates.
- Public descriptions and navigation present a generic Markdown workspace. Update creator-specific positioning while keeping the mdboard package/CLI identity and current release version.
- Update README/contributor instructions, root glossary/ADRs where needed, Unreleased CHANGELOG, this issue's comments, and the prototype verdict. Commit the finished work on one implementation branch. Publishing, pushing, merging, and release/version changes are separate work.

## Comments

### Approved handoff — 2026-10-08

The user requested the implementation prompt for A and specified a single branch. A is selected; graph refinements and the measured-dimension hover fix remain part of the reference. Use `feat/generic-markdown-workspace` for the entire implementation, based on production `main`, in the existing checkout. The prototype branch remains the primary-source archive. The new generic views are read-only; existing supported write capabilities are retained without making their conventions prerequisites for documents.

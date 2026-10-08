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


### Production implementation and review — 2026-10-08

Implementation is on the single `feat/generic-markdown-workspace` branch based on production `3332036`. The archive branch remains unchanged at `e8f012b`; `477054d` was inspected with `git show` and no prototype server, entry point, switcher, state inspector, or losing layout variant was promoted.

- `2f4eb14`: approved spec/prompt, glossary, A verdict, and ADR transition.
- `2404f9e`: production collection/metadata/relationship parsing, A modules, generic Board/maps, optional issue tools, documentation, and integration fixtures.
- `e0f1cfa`: review fixes for direct-folder membership, Chakra controls/layout, URL folder expansion, typed map settings, and additional production write/package coverage.
- `20da55e`: Board value picker and views distinguish missing properties from authored labels. Authored literals are JSON-quoted in the picker, so no authored value can collide with the special missing, empty, invalid, or conflicting labels, including the exact literal `No value (missing property)`.

The generic index discovers `.md`/`.markdown` recursively, retains unavailable file identities and directory warnings, and does not use issue classification. Raw property occurrences remain visible; Board identities separate missing, empty, authored labels, conflicts, and physical folders. Links/reference links, selected explicit dependency targets, global/local maps, reciprocal directions, independent local branches, safe reading/fragments/backlinks, live invalidation, and the existing authenticated targeted write/draft/recovery contracts are implemented.

#### Standards review

Initial findings: two documented-rule conflicts (custom control styling and transient folder expansion), one heuristic (stringly typed map settings), plus contradictory contributor text. `e0f1cfa` resolves all of them with Chakra controls/layout, URL-backed expansion, centralized finite settings, and corrected docs. The read-only follow-up found no remaining concrete Standards conflict.

#### Spec review

Initial finding: a directly selected folder containing a `docs/` child could omit top-level Markdown because the issue classifier also called it a repository. `e0f1cfa` makes generic discovery independent and adds API/production-App coverage. The read-only follow-up found no new product defects and confirmed measured-node retention remains intact.

A later Spec finding, an exact authored-label collision with the missing-property label, was resolved in `20da55e` and re-reviewed with no remaining concrete product findings.

Review summary: Standards had three findings, all resolved; Spec had two findings, both resolved. Browser validation is recorded separately below.

#### Checks established so far

- Regular typechecks, builds, and focused disk/API/production-App integration checks passed.
- Final full `pnpm check` after the last code change (`20da55e`): 138 tests, 138 pass, no failures or skips; typecheck and production build pass (about 164 seconds). An earlier full run passed 135 tests before the review fixes.
- The real React Flow integration covers A → B / C → B with A selected, C hover, controlled dimensions, stationary positions, selection, focus strokes, live refresh, all global presentations, and local direction/branch behavior. A mutation check proved that removing dimension retention makes the regression fail; the source was restored. No hover delays or diagnostic suppression were used. The test loads the real React Flow stylesheet with a deterministic jsdom geometry adapter.
- A final `pnpm pack` after the last code change succeeded (prepack typecheck and build passed). A locally packed app installed outside the checkout and passed its integration check, including runtime parser availability, assets, writes, events, boundaries, and shutdown. Offline installation initially lacked one mature transitive package; an online local-tarball installation populated the store, and offline verification then passed. The 2880-minute pnpm maturity policy was retained; package publication dates were verified. No release version changed.
- The expressly authorized read-only invest smoke compared filesystem/API discovery dynamically and opened a readable document. No private contents, fixtures, or fixed file count were committed or printed.

#### Packed production preview

A stale earlier preview (started before the reader body schema change) was stopped. The final packed tarball was reinstalled outside the checkout and a fresh production CLI was started against the disposable three-file fixture (`A.md` links `B.md#details`, `C.md` links `B.md`, `B.md` has a Details heading). Server-side checks on that preview: the root page and both built assets return 200, `/api/documents` returns three documents and the two expected link edges with no warnings, `/api/document` returns the reader `body`, and `/api/events` opens. Preview URL at handoff: `http://127.0.0.1:62686` (loopback only; it lasts only as long as that local process runs). These are API and asset checks, not browser acceptance.

#### Real-browser validation

Brave rejected the disposable fixture URL with `ERR_BLOCKED_BY_CLIENT`, and the in-app browser route was refused by automatic approval review. The Claude in Chrome extension then reached the app, but the production origin guard (`src/server/server.ts`) answered `403 invalid_origin`. A throwaway header-echo server (since removed) showed the extension's programmatic navigation carries `Sec-Fetch-Site: cross-site`, while the guard accepts only `same-origin` or `none` (a typed URL) with a matching Host. That is a limitation of automated navigation, not an app defect.

On the user's explicit instruction, a temporary edit allowing top-level document navigations was made to `src/server/server.ts` in the working tree only, built, and run from the checkout on loopback ports against disposable fixtures. It was never committed. It has since been reverted with `git checkout`, the checkout was rebuilt, and the built output was confirmed to contain no trace of it. The final packed preview keeps the strict guard and is unaffected.

Checks run in Chrome through the extension, using two disposable fixtures (the three-file A/B/C fixture and a throwaway nine-file fixture with nested folders and properties, since deleted):

- **Hover regression (A → B, C → B, A selected).** Hovering C at its center, the left, right, top and bottom borders and two corners kept C visible and its C → B edge shown. A stayed selected and the URL unchanged. DOM rects for all three cards were identical after every hover, every card stayed `visibility: visible`, and an observer recorded zero hidden states, zero restyles and no remeasure beyond the initial observation. With C still hovered, `C.md` was edited on disk and restored. `/api/documents` was refetched (6 to 7 requests) and the rects and visibility were unchanged afterwards. Input was driven by the extension's mouse events, not by a human hand.
- **Maps.** Overview, Directed, Folders, All connections, Focus connections, local Neighborhood for A (empty incoming lane, one outgoing) and for B (A and C incoming, no chain between them), and the Dependencies filter empty state all rendered correctly with correct arrow directions and lane labels. A and C were not joined.
- **Reader.** Following `Read B` from A navigated to B with `anchor=details`, showed the Details heading, and listed A and C as backlinks. Property occurrences, notices and a read-only badge show for ordinary files, and Issue tools appears for an issue file.
- **Board.** On the property fixture, Status grouped (empty), Conflicting (`Todo` and `Done`), a case-insensitively merged Done, arbitrary values, a literal `No value (missing property)`, and a true missing group as separate columns. The value picker listed the true missing entry unquoted and the literal quoted, and filtering by the quoted literal returned only that one file.
- **Light and dark.** Both modes rendered Files, Board, reader and Map. Observation: unselected map cards have a very faint border on the light canvas.
- **Keyboard.** Tab order across header, search, property filter, refresh and file rows was logical with labelled controls, the focus ring was a visible 2px orange outline, and Enter opened the focused file.
- **Narrow layout (500px wide).** The folder tree collapses to a Folder scope picker, and controls stack. Choosing `docs/archive` updated the URL, said "including subfolders", and listed the nested file.
- **Optional editing on an issue file.** The quick status change rewrote only the `Status:` line on disk, and appending a comment added only the comment under Comments. The console showed no application errors (only the Grammarly extension's own warnings).

Not exercised in a browser: New issue creation, full title/body edit save, stale-write and draft recovery. Those rely on the retained automated suites and the packed-app test. Non-blocking observations: the Board URL keeps map parameters from earlier map use, and the map card location label shows `.` for root-level files.

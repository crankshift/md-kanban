# Explore a generic Markdown workspace

## Problem

When mdboard opens `/Users/crankshift/khmara/git-docs/invest`, ordinary Markdown files under `docs/` and `.scratch/` are missing from navigation. Supporting-document discovery currently lists only specifications and maps beside discovered issue containers, plus the files directly in `docs/adr/`.

Read-only inspection on 2026-10-07 found 22 Markdown files and one Python file under those two folders. The current app represents four supporting documents and seven issue candidates, leaving eleven Markdown files absent from both lists. Missing examples include `docs/agents/*.md` and research notes under `.scratch/`.

## Agreed scope — 2026-10-07

- Recursively expose every Markdown file under `docs/` and `.scratch/`, including drafts, archives, and files without issue metadata. Non-Markdown files are outside this feature's scope.
- Make Markdown documents and folders the primary workspace concepts. Include issue files in the same collection, pointing to the same files as any board view.
- Replace Feature/Effort as the main scope filter with folder scope.
- Remove dependence on Matt Pocock's conventions: discovery and reading must not require issue numbering, fixed status values, or a particular issue-folder layout.
- Focus the current design/prototype on finding and reading files. The production editing transition remains to be designed; broader editing was not requested for this prototype.
- Explore a document relationship map with explicit Markdown links, incoming backlinks, and separately labelled dependencies when a target is established. Folder membership may group files visually; it does not imply a dependency.
- Ordinary documents remain documents regardless of metadata. The initial decision to preserve existing issue classification has been reopened by the user's generic-workspace direction.
- Expose existing status/type and other relevant metadata in file results and map nodes, with filters. Generic semantics and diagnostics are under discussion; fixed workflow validation must not define the document collection.
- Provide folder/path navigation and search across filenames, titles, and Markdown text.
- A directly selected `docs/`, `.scratch/`, or nested folder exposes its Markdown descendants within that selected boundary.
- Keep unreadable and oversized Markdown files discoverable with an explanation when their preview is unavailable.
- Include both a global map and a selected document's local neighborhood in the first version.
- Provide an optional read-only board grouped by any selected property (for example Status or Type) or by folder. Use the files' actual values and include a No value group; no status vocabulary or completion sequence is required.
- Read optional YAML frontmatter and leading `Key: value` properties, including bold keys. Preserve raw occurrences and surface duplicates/conflicts instead of silently choosing a value.
- Dependency edges require an explicit file path or Markdown link. Unresolved numeric references remain metadata, and statuses do not imply completion or blocking.
- Brainstorm first, then build a throwaway UI prototype to compare approaches before production implementation.

## Prototype question

Which arrangement best supports finding, reading, and understanding relationships among arbitrary Markdown files: A, a folder explorer with a reading pane; B, a property-focused workbench with a reading dock; or C, a graph-focused workspace with a file/reading rail?

All variants use the existing `/` route, switched with `?variant=A`, `B`, or `C`, and expose folder/search filters, optional-property grouping, global and local maps, and read-only document navigation. Real data comes from the selected folder at runtime, with no private document contents committed. Production implementation and layout selection follow prototype review.

Verdict — 2026-10-08: the user selected **A, the folder explorer with a reading pane**, by requesting its implementation prompt. The later graph refinements and hover fix are part of the reference. Production implementation is specified in [issue 02](issues/02-implement-variant-a.md) and its [single-branch prompt](implementation-prompt-a.md).

## Evidence

- `src/server/documents.ts`: `discoverDocuments` lists a narrow set of names and ADRs; `readDocument` already reads other in-boundary Markdown paths.
- `src/server/discovery.ts`: issue discovery is independent of supporting-document discovery and checks recognized issue containers and metadata.
- `src/server/document-types.ts`: listed supporting documents currently have only specification, map, or ADR kinds.
- `src/client/Documents.tsx` and `src/client/Navigator.tsx`: navigation and document search only see that narrow list.

## Comments

### Brainstorm round 1 — 2026-10-07

The user accepted recursive coverage with the clarification “all md files,” accepted a file browser alongside the board, and accepted discovery and reading first. They also asked whether a board or another view could show relationships between documents. A document relationship map is under discussion; no relationship semantics or layout has been selected.

### Brainstorm round 2 — 2026-10-07

The user accepted the recommended map, existing issue classification, and browsing baseline. They suggested React Flow for a graph resembling Obsidian and asked whether a generic document flow could make existing Matt Pocock-style issues and statuses more visible. Library choice and overall workspace hierarchy remain under discussion.

An AST-based, read-only check of the 22 Markdown files found 45 explicit relative Markdown-link occurrences, representing 42 unique directed file pairs. Fifteen files are connected and seven have no links; all five `docs/` files are isolated. All targets exist inside the two indexed folders. The existing dependency resolver finds no linked issue dependencies and one unsupported dependency entry. The prototype must show this real sparsity rather than fabricate connections; plain-text path mentions are not Markdown links.

### Graph tooling findings — 2026-10-07

[React Flow](https://reactflow.dev/api-reference/react-flow) supports pan/zoom, custom nodes, typed and styled edges, and controls for read-only navigation. It has [no built-in layout engine](https://reactflow.dev/learn/layouting/layouting). React Flow with D3-Force is a candidate for an Obsidian-style map; a directed dependency layout could use Dagre. Local neighborhoods require application-level filtering. These are prototype candidates, not an accepted production dependency decision.

The existing implementation and wayfinding workflows remain semantically valid in a generic document workspace. Their statuses could be exposed as issue metadata in file results and graph nodes. ADR 0002 keeps triage readiness distinct from wayfinding state and implementation dependencies advisory; a universal completion lifecycle would reopen that decision. The user is deciding whether to make the document workspace primary and whether custom workflows belong in the current scope.

### Brainstorm round 3 — 2026-10-07

The user explicitly rejected a Matt Pocock-oriented product and asked for folder filters rather than Feature/Effort filters. The generic workspace must tolerate changing author/agent conventions. They accepted metadata visibility across views and both local and global maps now. This supersedes the earlier proposal to retain the two fixed workflows as the organizing principle and reopens ADR 0002's creator-specific workflow choice. It does not imply a new universal meaning for status values or permission to rewrite existing Markdown.

### Brainstorm round 4 — 2026-10-07

The user accepted the recommended generic board, frontmatter plus leading properties, and explicit dependency targets. These answers settle the model for the requested read-only prototype. Existing editing behavior is outside this throwaway UI exploration. The prototype is captured on `prototype/markdown-workspace-2026-10-07`; no layout winner has been selected.

### Prototype handoff — 2026-10-07

The three layouts are implemented on the throwaway branch, with runtime-only source data and a development-only entry point. Run `pnpm prototype /path/to/folder` and compare `?variant=A`, `B`, and `C`. All share the settled generic model, optional property-based/folder boards, explicit selectable dependency properties, and global/local maps. Results, verification, limitations, and the pending layout verdict are captured in [issue 01](issues/01-prototype-generic-workspace.md) and the [prototype README](../../src/client/workspace-prototype/README.md).

### Directed layout dependency — 2026-10-08

The user accepted keeping `@dagrejs/dagre` for automatic node placement in the Directed map after checking React Flow's official layout recommendations. React Flow supplies the canvas and directed-edge rendering; Dagre supplies the automatic layered arrangement. Folder and local-neighborhood layouts use their own coordinate logic. This settles the Directed engine choice while the production layout selection remains open.

### Production implementation — 2026-10-08

A is the approved production interface. Issue 02 carries the full delivery and validation record. Generic discovery, optional properties, folder scope, Board, reader, and relationship maps are independent of the retained issue write adapter. The archive branch remains intact; implementation uses production `main` as its base and adds no prototype entry point or preview server.

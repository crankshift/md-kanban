# 01: Compare generic Markdown workspace layouts

Status: ready-for-agent

## Question

Which arrangement best supports folder browsing, property-based grouping, reading, and explicit relationships without depending on a particular issue workflow?

## Agreed prototype

- A: folder explorer with a reading pane.
- B: property-focused workbench with a reading dock.
- C: graph-focused workspace with a file/reading rail.
- All variants support the real selected folder, generic metadata, search, optional board grouping, and global/local maps.
- Read-only, throwaway code; source documents are never modified.

## Primary source

Branch: `prototype/markdown-workspace-2026-10-07`.

Run `pnpm prototype /path/to/folder`, then compare `?variant=A`, `B`, and `C` on the printed URL. The design question and settled scope are recorded in [the spec](../spec.md) and [ADR 0008](../../../docs/adr/0008-generic-markdown-workspace.md).

## Comments

### Design handoff — 2026-10-07

The brainstorm is settled; prototype construction is authorized. Layout selection needs human review. This triage status does not record implementation completion. No prototype winner or production rewrite is claimed.

### Prototype result — 2026-10-07

- Built the three variants on the existing route behind a development-only entry point. Runtime indexing includes every `.md`/`.markdown` descendant in scope, independent of the old issue parser. Folder/search/property filters, literal-value and folder grouping, a reader, links/backlinks, and global/local maps are available throughout.
- React Flow 12.12.0 supplies navigation and custom keyboard-openable file nodes; D3-Force 3.0.0 computes a finite static layout. YAML 2.9.1 preserves frontmatter pairs. Dependency-property selection supports author-defined names; only explicit file targets become dependency edges.
- `invest` preview contains all 22 Markdown files and 42 unique directed Markdown links; 15 files are connected and seven remain discoverable without links. No dependency edges are fabricated from the existing numeric reference.
- Browser verification covered all three variants, reading the previously missing agent docs, property input clicks and filtering, Status and Folder grouping including No value, keyboard graph opening, a seven-file local neighborhood and return to the 22-file global map, light/dark appearance, and narrow-screen folder/reader access with no horizontal overflow. Temporary public fixture documents verified duplicate YAML values, arbitrary statuses, custom dependency mapping, `.markdown` files, link fragments, and unavailable previews. POST to the preview endpoint returns 405.
- Current library docs were fetched with the newly available `ctx7` CLI: React Flow `/websites/reactflow_dev`, Chakra `/websites/chakra-ui`, D3-Force `/d3/d3-force`, and YAML `/eemeli/yaml`. Earlier official-document research remains linked in the spec. Registry checks confirmed all new dependencies and the current React/Chakra/router/query stack are latest. Vite 8.3.3 is newer than the installed 8.3.2 but is rejected by pnpm's existing minimumReleaseAge policy; the policy was retained.
- No layout winner has been selected. Status is needs-info while waiting for the user's prototype feedback. Production implementation is a separate step; no release change is claimed.
- Final verification passed type checking, JavaScript syntax checking, production build, and whitespace checking. Production assets contain none of the prototype endpoint, workspace, or switcher markers. All 23 original `invest/docs` and `invest/.scratch` files retained identical contents and modification times during browser/API verification. No prototype tests were added.
- Development console notes: the shared theme provider emits React's script-tag warning; a React Flow nodeTypes warning occurred during hot replacement, while the nodeTypes object is defined outside rendering. The existing production bundle-size warning remains. These did not block the verified journeys and are recorded for the production rewrite.
- Final Context7 cross-checks also covered React effect cleanup (`/reactjs/react.dev`), React Router search-parameter navigation (`/websites/reactrouter`), and TanStack Query refresh/structural sharing (`/tanstack/query`). No additional code changes were needed.

### Graph readability iteration — 2026-10-08

The user found the full directed force graph too tangled. Added Overview, Directed, and Folders presentations plus a local reading map. Straight boundary-to-boundary edges replace looping fixed-handle Bezier curves; reciprocal references share a stroke without losing their original directions. Selection/hover isolates direct connections and fades unrelated files, while All connections restores every display connection. All 22 files remain discoverable, including files with no links. Metadata is quieter and dependency configuration is expandable.

The real folder has 42 directed Markdown links, represented by 38 combined display connections. The file selected in the user's screenshot has one direct connection; focus mode now displays that one line rather than the entire network. The strategy specification's local map contains seven files and six direct display connections, with incoming, outgoing, and two-way branches. Neighbor-to-neighbor relations remain available through All connections. Placing two-way neighbors on separate branches avoids falsely suggesting a chain between them.

Used Context7's `/dagrejs/dagre` and `/websites/reactflow_dev` docs, checked installed types, and installed the registry's latest `@dagrejs/dagre` 3.1.1. Browser checks verified all three layouts, nine explicit folder groups, restoration of all 38 connections, keyboard opening, and the two-file and seven-file local maps. Type checking and production build passed; production assets still exclude preview code. No layout winner or production rewrite is claimed.

### Hover flicker fix — 2026-10-08

The user reported repeated state changes while hovering graph cards. Reproduced on the real graph and minimized to three documents: A links to B, C links to B, A is selected, and the pointer rests over C in the folder layout. A browser regression probe found 13–18 extra enter/leave transitions across 16 stationary-pointer samples with constant card geometry; the real folder showed 73 transitions in one check.

The controlled nodes were recreated for highlighting without their measured dimensions. The installed React Flow implementation resets measurements for replacement nodes and temporarily hides nodes without dimensions, causing a leave/re-enter feedback loop. Retain dimension-change notifications by node ID and pass those measurements back when replacing nodes; keep event handlers stable with useCallback. No estimated card dimensions or hover delay is used.

The same browser probe passed with zero extra transitions at card centers and several border offsets, while retaining the intended hover highlight. The original 22-file graph also passed at its card center and border with six stable highlighted connections. Temporary diagnostics and the edge hit-testing experiment were removed. Context7 docs and the installed React Flow source/types were used to verify the behavior; no permanent test suite is added to throwaway UI code.

After diagnostic removal, 72 browser samples spanning the live-refresh interval kept six connections, active hover, visible cards, and one unchanged geometry state. Type checking and production build passed. The fix stays on the throwaway branch.

### Verdict and implementation handoff — 2026-10-08

The user selected variant A by requesting its implementation prompt on a single branch. The prototype question is answered: use the folder explorer with its reading pane, retaining the refined graph views and measured-dimension hover fix. The primary-source code is captured at `477054d`. Production work is assigned to [issue 02](02-implement-variant-a.md) through the [implementation prompt](../implementation-prompt-a.md), on `feat/generic-markdown-workspace` from main. The earlier needs-info state is satisfied; the triage vocabulary is not a completion lifecycle.

### Approved A verdict and production transition — 2026-10-08

The user selected **A, the folder explorer with a reading pane**, and authorized issue 02 on `feat/generic-markdown-workspace` based on production `main`. The complete prototype remains on its archive branch; immutable capture `477054d` includes the graph readability work and `4431b92` hover fix. Production rewrites the approved behavior into server indexing/parsing and client workspace modules, retaining optional issue write capabilities under their original contracts. B, C, the preview server, floating switcher, and state inspector do not belong in production.

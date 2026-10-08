# Shrink the shipped client bundle

## Problem

`pnpm build` emits a single 1,284 kB (380 kB gzip) entry chunk, `dist/client/assets/index-*.js`, and Vite warns that it exceeds 500 kB. Only the document map (`DocumentMap`, React Flow, D3-Force, Dagre) is lazy-loaded today. Everything else, including code the browser never runs, is parsed on first load.

Measured on 2026-10-08 from a sourcemap build of the entry chunk:

| Bucket | kB |
| --- | --- |
| Chakra stack (`@chakra-ui`, `@zag-js`, `@ark-ui`, `@emotion`, …) | 405 |
| `react` + `react-dom` | 213 |
| Markdown pipeline (`react-markdown`, micromark, mdast, hast, …) | 126 |
| `react-router` | 91 |
| `@dnd-kit/*` | 86 |
| `zod` | 79 |
| Application source | 77 |
| `react-hook-form` | 34 |
| `@tanstack/query-core` | 31 |

`App.tsx` always renders `<Board … embedded />`, so the non-embedded branch of `Board.tsx` (Navigator sidebar, status drag board, supporting-document list) is unreachable in the product, yet it ships, together with dnd-kit.

The app is served from localhost (ADR 0001), so transfer size is nearly free; the cost being reduced is JavaScript parse and compile time on first load. ADR 0004 already accepted a larger bundle in exchange for Chakra.

## Agreed scope — 2026-10-08

- Optimize what ships to the browser. Test-only code and dev-only dependencies are not a concern in themselves.
- Defer code that first paint does not need, and split vendor code so that every emitted JavaScript chunk stays under Vite's default 500 kB warning limit. Keep `chunkSizeWarningLimit` at its default.
- Lazy-load the issue tools overlays (issue details, editor, creator, repair panel, dependencies, and `react-hook-form`) and the safe Markdown renderer. Keep the small Workspace views (generic Board, folder tree, file results) eager.
- Vendor chunk groups: `react` (react, react-dom, scheduler) and `chakra` (`@chakra-ui`, `@zag-js`, `@ark-ui`, `@emotion`, `@floating-ui`, `@pandacss`, `@internationalized`). Everything else stays in the entry chunk.
- Suspense fallbacks: the reader shows `Loading document…` as a status message, matching the map's fallback; the issue tools overlay renders nothing while its chunk loads.
- A test fails when any emitted `dist/client/assets/*.js` file exceeds 500 kB.
- Delete the unreachable standalone board UI and every test that mounts it. Issue tools remain a supported capability (ADR 0008); only the legacy standalone path goes. Accepted loss: fine-grained stale-write and repair coverage that existed only in legacy-mounted tests. App-mode coverage of the issue tools remains.
- Rename the component that hosts the issue tools from `Board` to `IssueTools`, since **Board** in the glossary names the generic grouped view.
- Out of scope: replacing or slimming `zod` on the client (the schemas are shared with the server).
- No server-side changes: every API endpoint remains in use after the removal.

## Tickets

1. `issues/01-split-client-bundle.md` — lazy boundaries, vendor groups, chunk-size test.
2. `issues/02-remove-legacy-board.md` — delete the standalone board path and its tests; rename to `IssueTools`. Lands after 01.

Both tickets are implemented in order on one branch, `perf/client-bundle`, with one focused commit per ticket.

# 02: Discover tickets and render read-only boards

Status: ready-for-agent
Blocked by: 01

## Outcome

Launching md-kanban against a supported folder displays its real implementation or wayfinding issues as compact cards in the correct status columns.

## Scope

- Discover supported issue containers under `.scratch` and `docs`, recognizing `issues/` and `tickets/`, as well as directly selected tracker, feature, or issue folders. Combine locations within the selected root without duplicate files.
- Parse numbered filenames/headings, titles, plain and bold metadata keys, status, wayfinding type, and dependency text. Retain original content and a file revision suitable for later stale-write checks.
- Give each issue an identity scoped by its location and feature/effort, rather than ticket number alone.
- Distinguish implementation and wayfinding workflows. Use their existing status vocabularies in separate views, compact cards, and feature/number ordering.
- Show missing/unknown statuses, ambiguous workflow, or malformed issue candidates in Needs attention with readable diagnostics and access to original text.
- Keep specs, maps, ADRs, ordinary documentation, generated assets, and dependencies out of issue discovery. ADRs remain excluded even when they contain status metadata.

## Acceptance criteria

- Fixtures cover repository-root, `.scratch`, `docs/tickets`, feature, and direct issue-folder launches; mixed locations; repeated numbers across features; plain/bold keys; and both workflows.
- A numbered ticket is not assigned a guessed workflow or status when the evidence is ambiguous. Malformed candidates are visible and do not crash the board.
- An ADR with `Status: proposed`, plus a specification and map, is excluded from both cards and Needs attention.
- The board displays real card titles, numbers, feature/location context, and the correct columns; switching workflows preserves their different meanings.
- Discovery stays within the selected root, including when paths or symbolic links point elsewhere.
- Meaningful parser/discovery checks, relevant UI checks, type checking, and production build pass.

## Comments

### Implementation result — 2026-10-06

- Implemented discovery and `GET /api/issues` across repository `.scratch`/`docs` locations, tracker roots, features, and directly selected issue folders (including arbitrary names). Recognizes `issues/` and `tickets/`, deduplicates canonical paths, and scopes identities by root-relative file path with feature, location, and container context. Cards sort by feature then numeric issue number, with location/path tie-breakers.
- Parses numbered filenames/headings, titles, plain/bold metadata keys (including both bold-colon forms), supported statuses and wayfinding types. Retains original Markdown, raw dependency text (including number/title and no-dependency representations), and a SHA-256 content revision. Zod validates metadata and the frontend API payload. Metadata comes from the leading block; body examples/comments do not override it. Invalid status, duplicate/malformed metadata, conflicting workflow evidence, missing title, and conflicting numbers remain in Needs attention with diagnostics and expandable original text.
- Added compact read-only implementation/wayfinding boards using their separate status vocabularies, folder context, loading/error/empty states, and diagnostic original-text access. React escapes issue text; no Markdown HTML executes. No issue mutation was introduced: non-read requests remain rejected with 405, original fixtures stay untouched, and stale-write enforcement remains required when write endpoints arrive. The retained revision supports that future work but is not itself a write API.
- Discovery excludes specifications, maps, ADR trees (even with Status metadata), ordinary non-numbered documentation, generated assets, and dependency directories. Skips symbolic links inside the selected root; an explicitly selected symlinked root uses its canonical target as the boundary. Checks path components and opened-file identity before reading, including an ancestor-symlink-swap regression. Unreadable numbered issues surface diagnostics; unreadable directories surface warnings.
- Updated README and contribution guidance for discovery, parser/API boundaries, current read-only behavior, fixtures, and packed-package verification. Consulted official [Node filesystem](https://nodejs.org/api/fs.html), [Node crypto](https://nodejs.org/api/crypto.html), [React effects](https://react.dev/reference/react/useEffect), [Zod](https://zod.dev/api), and [Vite server options](https://vite.dev/config/server-options) documentation. Context7 was unavailable; official documentation was used directly.
- Verification: final `pnpm check` passed type checking, production build, and all 17 tests. Parser/discovery tests cover supported launch targets, mixed locations, repeated numbers, metadata styles, both workflows, malformed candidates, document exclusions, retained contents/revisions, symlinks, sorting, and direct folders containing supporting docs. UI checks cover columns, titles/context, ordering, diagnostics/original text, and escaping. CLI/API checks verify real boards and no writes. The packed-package test now verifies a real issue through the installed package's API in addition to assets and shutdown. Both staged and working-tree whitespace checks passed. Loopback/package tests ran outside the restricted sandbox using the existing pnpm store.
- Visually verified the production board in Brave against the repository and portable temporary fixtures: nine real implementation issues, workflow switching, distinct populated wayfinding columns, location context, and expandable diagnostics/original text. Standards review found no documented violations or actionable smells; its filesystem boundary race was corrected and regression-tested. Spec review found a direct-folder discovery edge case, corrected and regression-tested. Both reviewers confirmed their findings resolved and no new findings.
- Limitations/context for ticket 03: reload reads external changes; watching is deferred to 07. Dependency text is retained but resolution, badges/navigation, card details, search, and location/feature filters belong to 03. Use the root-relative `id`/`path` to select an issue, and feature/location/container context to scope dependencies; feature names and numbers alone are not unique. `src/server/board.ts` holds shared schemas/statuses/order; `issues.ts` parses preserved content; `discovery.ts` owns filesystem access; `src/client/Board.tsx` renders read-only boards. Supporting-document browsing and Markdown rendering are still deferred. Triage status remains `ready-for-agent`; only the workflow checkbox records completion.

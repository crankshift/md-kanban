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

# 03: Read issue details, dependencies, and search results

Status: ready-for-agent
Blocked by: 02

## Outcome

A user can find relevant work, read a selected issue in a side panel, and navigate its dependencies without modifying files.

## Scope

- Render the selected issue's Markdown body and comments in a side panel, with clear status, feature, and location context. Treat rendered Markdown as untrusted content rather than executing embedded HTML or scripts.
- Search titles and bodies and combine search with feature/location filters. Keep card ordering predictable.
- Resolve dependency references within the same feature or effort, supporting numbers plus titles and supported no-dependency text.
- Show advisory dependency indicators and clickable links. Calculate wayfinding blockers from unresolved referenced issues; do not infer implementation completion from triage readiness.
- Surface missing or ambiguous references without silently dropping them or inventing a target.

## Acceptance criteria

- Search finds title/body matches across locations; search and both filters compose correctly.
- Clicking a card opens its correct details even when another feature contains the same ticket number.
- Clicking a resolved dependency navigates to that issue. Missing/ambiguous references remain visibly diagnosable.
- A wayfinding prerequisite in `resolved` no longer blocks its dependent issue; implementation readiness never produces a false completed prerequisite.
- Dependency displays are read-only and advisory, and this issue writes no ticket files.
- Relevant integration/UI checks, type checking, and production build pass.

## Comments

### Implementation result — 2026-10-06

- Added a read-only issue details side panel selected by the root-relative issue identity, with status/workflow, feature/effort, location, and file context. Clicking anywhere on a card opens its issue; the title button also supports keyboard access. The panel renders the preserved Markdown document, including body, comments, and GFM checklists/tables. Close/Escape dismisses it, and dependency navigation focuses the updated panel. Needs attention entries retain original-text access and can also open details.
- Added case-insensitive title/body/comment search composed with location and scoped feature/effort filters. Features with the same name in different locations have separate options; changing location resets the feature selection. Matching cards retain feature/number ordering. Navigation can open a dependency hidden by current filters and switch to its workflow without losing those filters.
- Added pure shared dependency resolution in `src/server/dependencies.ts`. Numbers (including leading zeroes and optional `#`) resolve within the same feature/effort and location across `issues/` and `tickets/` containers. Number-plus-title references, title commas, and `None` / `None (first issue)` / `None (can start immediately)` work while retaining original dependency text. Missing, ambiguous, empty, and unsupported references stay visible; ambiguous numbers list candidate paths and are not linked to a guessed target. Unambiguous references open the actual issue by its path identity, including candidates with diagnostic metadata.
- Dependency badges remain advisory. Valid wayfinding prerequisites in `open`/`claimed` block; `resolved` no longer blocks. An invalid or implementation prerequisite has unknown completion for wayfinding calculations. Implementation dependencies never infer completion from triage readiness. No product mutation was introduced: POST/PUT/PATCH/DELETE requests remain rejected with 405, and fixtures stay unchanged. Original content/revisions and the existing filesystem boundary remain intact; stale-write enforcement must be added with ticket 04's first mutation.
- Used `react-markdown` 10.1.0 with `remark-gfm` 4.0.1, `skipHtml`, and the default safe URL transform. Embedded HTML/scripts are ignored, unsafe script URLs do not execute, and rendered task checkboxes are disabled. Consulted official [react-markdown](https://github.com/remarkjs/react-markdown), [remark-gfm](https://github.com/remarkjs/remark-gfm), [React state](https://react.dev/reference/react/useState), [React act](https://react.dev/reference/react/act), and [jsdom](https://github.com/jsdom/jsdom) documentation; Context7 was unavailable. jsdom 26.1.0 is a test-only dependency compatible with the declared Node minimum. README and contribution guidance describe current behavior, syntax, boundaries, and verification.
- Verification: final `pnpm check` passed strict type checking, production build, and all 24 tests, including CLI/API and offline installed-tarball checks. Added dependency cases and React/jsdom interaction checks at the established board/UI seams for duplicate numbers/locations, composed filters, body search, scoped navigation despite hidden targets, ambiguous/missing/unsupported diagnostics, resolved wayfinding blockers, advisory readiness, no-dependency text, safe Markdown/comments, disabled checkboxes, and unchanged files. Relevant test files and type checking ran during implementation; the comma-title regression was observed failing before its fix. `pnpm install --frozen-lockfile --offline` passed. Fixtures and committed paths are portable and public-safe. Working/staged diff whitespace checks passed.
- Visually verified the production app in Brave against portable temporary fixtures: readable side panel, rendered body/comments/checklists, implementation advisory labels, wayfinding resolved prerequisite, missing/ambiguous paths, body search, and navigation to a prerequisite hidden by the query. Loopback and package verification used execution outside the restricted sandbox, as in prior tickets.
- Code review: Standards found no documented violations or material smells. Spec found commas inside dependency titles produced false diagnostics; corrected the reference boundary and added a passing regression. Both reviewers confirmed the correction and no remaining findings.
- Limitations/context for ticket 04: all data is still loaded on page reload; watching remains ticket 07. Status changes, editor/comment mutations, creation, and supporting-document navigation remain deferred. Markdown currently renders the entire preserved issue, including its leading metadata. Keep path-based selection and resolve dependencies using the complete board rather than filtered cards. Add status mutation at the existing server/API boundary with revision-based stale-write rejection and targeted Markdown preservation; report failed saves visibly and update board data only after persistence succeeds. Triage remains `ready-for-agent`; only the workflow checkbox records completion.

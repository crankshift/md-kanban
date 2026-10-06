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

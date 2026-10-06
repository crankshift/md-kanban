# 08: Browse supporting documents and ADRs

Status: ready-for-agent
Blocked by: 07

## Outcome

A user can read specifications, wayfinding maps, and architectural decisions beside the board and follow local document links from issues.

## Scope

- Add read-only supporting-document browsing and rendered Markdown in the side panel.
- For a repository-root launch, discover `docs/adr` alongside the specifications and maps associated with recognized issue containers.
- Resolve relative local Markdown links from their source document and open available targets within the selected root. Show clear unavailable results for missing or out-of-scope targets.
- A direct issue-folder launch remains restricted to that folder and does not automatically expand access to parent repositories.
- Reuse safe Markdown rendering and keep supporting-document metadata separate from issue parsing.

## Acceptance criteria

- Repository-root browsing exposes specs, maps, and ADRs; selecting one renders its Markdown without editing controls.
- An ADR containing `Status: proposed` is a supporting document, never a card or Needs attention entry.
- Links from an issue or specification open the correct in-root target and handle fragments where supported by the renderer.
- Missing targets and links escaping the selected root, including via symlinks, are reported as unavailable rather than read anyway.
- Reading a supporting document writes no files, and its content stays current when revisited after an external edit.
- Relevant link/discovery/UI integration checks, type checking, and production build pass.

## Comments

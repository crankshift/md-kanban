# 04: Persist status changes without overwriting other edits

Status: ready-for-agent
Blocked by: 03

## Outcome

A user can drag a card to another status column and have that status saved to its original Markdown file, with visible recovery when a write fails or conflicts.

## Scope

- Introduce the shared write boundary needed by this and later editing issues: validate requests, require the expected file revision, constrain paths to the selected root, and reject stale writes.
- Patch only the issue's status metadata, preserving its existing plain/bold style and all other bytes outside the intended change.
- Persist cross-column drag operations immediately. Provide an accessible status-change alternative and preserve feature/number ordering rather than introduce priority ranks.
- Report failures and stale-write conflicts clearly; do not leave a failed optimistic move displayed as if it succeeded.
- Allow transitions despite advisory dependencies; restrict statuses to the issue's recognized workflow.
- Keep write requests tied to the local app session and prevent arbitrary sites or paths from writing through the local server.

## Acceptance criteria

- Both metadata styles update correctly while unknown sections, checkboxes, comments, and unrelated formatting remain intact.
- An external edit after loading causes the stale status save to be rejected, leaving the external version intact.
- Concurrent writes based on the same revision cannot both silently succeed; later editing operations can reuse this behavior.
- Invalid statuses, out-of-root paths, and invalid write requests fail without altering files.
- Write errors restore or refresh the displayed card status and give the user an actionable result.
- Relevant disk/API/UI integration checks, type checking, and production build pass.

## Comments

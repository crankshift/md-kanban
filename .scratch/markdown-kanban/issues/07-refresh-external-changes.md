# 07: Refresh external changes while protecting drafts

Status: ready-for-agent
Blocked by: 06

## Outcome

The board stays current as agents edit, create, rename, or remove files, while a user's unsaved work remains recoverable.

## Scope

- Observe selected-root file changes and reconcile the discovered issues with the board, including newly created files and atomically replaced files.
- Refresh untouched issues automatically without resetting search, filters, workflow selection, or unrelated detail state.
- Keep dirty editor drafts when their files change, disappear, or become invalid. Surface conflicts and provide reload or draft recovery rather than silently rebasing or overwriting.
- Integrate successful app writes with external refresh so duplicate notifications do not lose drafts or produce false saved states.
- Clean up watchers and update connections when the server shuts down.

## Acceptance criteria

- Agent-like writes, creations, renames, deletions, and atomic replacements update the board without a process restart.
- Dirty drafts survive external updates/deletions and stale saves remain rejected by the existing write boundary.
- Changes in one issue do not reset another issue's draft or board filters.
- Files becoming malformed move to Needs attention with a diagnostic; supporting documents remain excluded as issues.
- Shutdown releases watcher resources and connections.
- Relevant watcher/server/UI integration checks, type checking, and production build pass.

## Comments

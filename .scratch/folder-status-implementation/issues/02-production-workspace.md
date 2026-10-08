# Deliver compact status boards and generic document tools

Status: ready-for-agent

Implement approved A with library-backed pointer/touch/keyboard dragging and cursor-following overlay, authored destination memory, generic tools/creation and URL navigation/visibility/dialog state.

## Comments

Implementation underway. Production App/UI integration seam: real API and disk, keyboard/pointer lifecycle, folder scope and draft recovery.

## Result

Implemented approved A with server-derived statuses and @dnd-kit/core sensors/portalled overlay; case-folded authored identities stay distinct from No status/Check status system groups. Scope destinations precede card filters, survive session view/scope changes, and track visibility provenance. URL state restores scopes/eyes/navigation/dialogs; narrow navigation includes folder eyes and New folder. Generic source/comment/status forms replace workflow-gated tools; creation supports editable title filenames, numbering suggestions, optional authored status and immediate folder creation. Query writes cancel reads, preview/rollback, refresh from disk and retain failed submitted drafts; forms preserve external-edit recovery and explicit discard guards.

Validation: regular typecheck/build; production App integration covers generic source/comments, stale drafts, arbitrary-status issue/folder creation and cancellation, hidden linked reads/live refresh, status collisions/scoped filters/session destinations, pointer overlay movement/cancellation/stale pickup and lost-response draft recovery. Real-browser keyboard movement/focus/Escape and real mouse drop wrote preserved disk data. Light/dark and 390px responsive layouts, custom status, real new folder/issue and ordinary-note tools inspected. Physical touch hardware is unavailable; library touch activation is included but physical-touch verification is not claimed. Final full checks/review are tracked in ticket 03.

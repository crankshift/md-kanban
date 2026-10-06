# 12: Drag cards between status columns

Status: ready-for-agent
Blocked by: 11

## Outcome

A user can drag a card to another status column with a mouse, touch, or the keyboard, and the move appears immediately while it is saved.

## Scope

- Use `@dnd-kit/react`, pinned to an exact version (`0.5.0` was used in the prototype; check the current release and changelog before choosing).
- Columns are drop targets; cards are draggable. There is no reordering within a column: card order stays feature, then ticket number.
- Dropping on another column moves the card optimistically through the existing status mutation; a failed or stale save returns the card to its original column with an error.
- Support keyboard dragging and announce moves to assistive technology. The card's status menu stays available as an alternative.
- A card that is being saved or created cannot be dragged.
- Highlight the column under the dragged card.

## Acceptance criteria

- Dragging a card to another column changes only its `Status` line and shows it in the new column immediately.
- A rejected move returns the card and shows the reason.
- A card can be moved between columns using only the keyboard, and screen readers announce the result.
- Dropping a card on its own column, or cancelling a drag, writes nothing.
- Relevant interaction tests, type checking, and the production build pass.

## Comments

### Implementation result — 2026-10-06

- Added hook-bearing drag handles and status-column drop targets in `src/client/DragBoard.tsx`, used by Board view for both workflows. Mouse dragging starts from the grip; touch holds briefly before moving. Keyboard handles support Space/Enter pickup/drop, arrows (Shift for faster movement), and Escape cancellation. Columns highlight under the dragged issue, accessible instructions and live announcements name issues and target statuses, and keyboard focus returns after a move or rollback. Status menus and List behavior remain available. Cards continue sorting by feature and issue number; no priority ordering or deferred feature was added.
- Drops reuse the existing `POST /api/status` TanStack mutation and shared writer. Pickup captures the original issue snapshot before drag initialization, including its revision, so live refresh cannot silently substitute a newer revision into the write. Cross-column drops appear optimistically; failure/staleness rolls back, refreshes disk data, and reports the reason inline and by toast. Save results have a live status message. Only the existing targeted Status value changes; unknown metadata/sections, formatting, body, checkboxes, and comments remain intact. Cancelled, own-column, and outside-column drops invoke no write. All handles pause during writes/reloads; the unconfirmed creation placeholder is disabled.
- Retained exact `@dnd-kit/react` 0.5.0 and declared exact `@dnd-kit/dom` 0.5.0 as a development dependency for its accessibility plugin; that DOM package was already present transitively. Runtime dependencies remain only `open` and `zod`. Consulted official [changelog](https://dndkit.com/changelog/), [release](https://github.com/clauderic/dnd-kit/releases/tag/@dnd-kit%2Freact@0.5.0), [provider](https://dndkit.com/react/components/drag-drop-provider/), and [draggable](https://dndkit.com/react/hooks/use-draggable/) documentation, then verified API/sensor details against the installed 0.5.0 types and implementation. The current official changelog identifies 0.5.0 as the latest release. Context7 was unavailable. Updated README, CONTRIBUTING, and Unreleased CHANGELOG.
- Verification: `pnpm check` passed strict type checking, production build, and all 111 tests on macOS (none skipped), including real disk/API preservation, concurrency/stale writes, live refresh/editor recovery, CLI, and offline installed-tarball checks. Type checking and targeted drag/board/navigator tests ran during development. New interaction coverage exercises keyboard move/cancel, no-write own/outside/cancelled drops, preserved Markdown/order/focus, optimistic pending state and failed rollback, a stale pickup revision after live external refresh, and wayfinding moves with advisory blockers. Existing creation coverage now verifies that all handles and the unconfirmed placeholder are disabled. Frozen-lockfile installation and diff whitespace checks passed. The initial offline dependency-install attempt lacked public registry metadata; a subsequent frozen install succeeded. Tests use portable temporary fixtures and root-relative public-safe paths.
- Production-browser verification: headless Brave with temporary public-safe issues passed real mouse movement, highlighted target columns, touch-emulated dragging, keyboard movement, Escape cancellation, restored focus, targeted Markdown preservation, and zero browser exceptions. Inspected the resulting screenshot. Disposable browser/server/fixtures were stopped and removed; browser scripts/screenshots stayed outside the repository. jsdom coverage supplies missing observer, animation, hit-testing, and DOM-realm APIs plus deterministic column geometry; its unsupported dnd-kit CSS layer/nesting parse diagnostic alone is filtered, while other DOM errors remain visible.
- Code review against starting commit `c429fb9`: Standards found zero documented violations or actionable smells; Spec found zero missing, incorrect, or extra requirements. Both reviewers confirmed reuse of the revision-protected mutation boundary, ordering, no-op drops, disabled pending/creating handles, and keyboard recovery. Browser verification addresses their shared geometry-validation note.
- Limitations: keyboard sensors move by pixels; Shift plus an arrow reduces the number of presses on wide columns. Touch was verified through Chromium emulation, and live-region contents through UI assertions; no physical touch device or audible screen-reader session was tested. Existing draft/lost-response and filesystem lock/final-check limitations from earlier tickets remain. The production build retains the accepted, nonblocking bundle warning (about 1.26 MB minified / 373 kB gzip); no unrelated bundle splitting was added.
- Handoff for ticket 13: Needs attention remains diagnostic/read-only; this ticket adds no repair endpoint. Keep repairs in the existing authenticated query-mutation/shared-writer boundaries and retain stale revisions. Reuse the Write/Preview editor, pickers, dirty-form navigation protection, rollback/toasts, and server diagnostics rather than assigning workflows in the browser. Dragging is only for recognized workflow cards with confirmed revisions. Triage remains `ready-for-agent`; only the workflow checkbox records completion.

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

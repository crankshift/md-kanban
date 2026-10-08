# Define folder visibility behavior

Type: grilling
Labels: wayfinder:grilling
Status: resolved
Parent: ../map.md
Blocked by: 01

## Question

How do folder hide/show choices interact with navigation, document links, and remembered view state?

The board-model decision established collection-level visibility, default-hidden dependency/generated folders with on-demand reveal, and permanent .git exclusion. Settle parent/child visibility, hiding a selected folder or open document, direct links into hidden folders, empty-folder access for creation, the full default-hidden categories, and how choices survive navigation, reload, and separate browser sessions. Distinguish visibility from the launch boundary and symlink protections.

The creation decision additionally requires New folder. Settle where that action is available, whether it creates a real directory immediately, and what remains if issue creation is cancelled.

Prerequisite: [Define the folder and status board model](01-define-folder-and-status-board-model.md).

## Answer

The user accepted the following visibility and folder behavior on 2026-10-08:

- An explicit link may open a document inside a hidden folder without revealing that folder or adding its documents to the board/map collection. Hiding is collection visibility, not an additional read-access boundary; launch-boundary and symlink protections remain in force.
- Hiding a folder hides its descendants. If it hides the selected folder scope, move scope to the nearest visible ancestor. An open reader can still show the hidden document under the explicit-reading rule rather than silently revealing its folder; preserve existing draft guards.
- Default-hide node_modules, vendor, .pnpm-store, dist, build, coverage, .cache, and .next. Ordinary folders, including .scratch, .agents, and .codex, start visible. .git stays excluded.
- New folder is available in both the folder tree and New issue's folder picker. It creates a directory immediately under the chosen parent. Empty folders remain visible and selectable, and a created folder remains if issue creation is cancelled.

For persistence, the user raised changing localhost ports and described automatic memory across launches as a plus rather than a requirement now. Retain ADR 0005's URL view state for reload and Back; fresh launch URLs use the default visibility rules. Defer automatic cross-launch memory as optional follow-up instead of blocking this prototype on it. If pursued later, server-side preferences keyed by launch folder can avoid browser-origin/port isolation; no preference-file design is selected here.

Documentation checked with Context7 (/mdn/content) and [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage): browser storage belongs to an origin, whose scheme/host/port tuple is described in [MDN's same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy). A new port uses a separate storage area; it does not delete the area belonging to the old origin.

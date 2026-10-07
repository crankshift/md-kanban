# 17: Make board controls and issue cards compact and consistent

Status: ready-for-agent

## Outcome

Dropdowns open when clicked anywhere in the field, filter actions align with their inputs, issue titles have room to read, and connection status has space before the theme toggle.

## Agreed decisions — 2026-10-07

- Shared searchable pickers open on input clicks. Their chevrons have no inset button border.
- Filter actions align with inputs rather than labels plus inputs.
- Cards put a full-width title first, with a small issue number, feature/effort, and dependencies below. Remove the status menu and separate drag grip.
- Clicking anywhere opens details. Pointer movement past a small threshold drags the whole card. Enter opens details; Space starts keyboard dragging. Keep the status picker in details as an alternative.
- Use self-hosted Roboto Condensed for issue titles and column headings; controls/body retain IBM Plex Sans.
- Align connection text left and the theme toggle right across the padded footer; stack the controls in the collapsed rail.
- Add vertical spacing around save feedback between the filters and board.

## Prototype question

Which compact title-first layout reads best in the real navigator: A, separate cards; B, full-width status lanes with continuous rows; or C, groups within each status column?

The user selected A. On the archived prototype branch, run `pnpm prototype`, then switch `?variant=A`, `B`, or `C` using the floating bottom bar. The prototype reads the current folder and holds status moves in memory; it never writes Markdown. Remove preview scaffolding when folding A into production.

## Acceptance criteria

- Shared searchable pickers open from input clicks and show a plain, unboxed chevron in every form. Clear/reload actions align with the inputs and the filters can wrap.
- Production cards match A: condensed full-width title, small number and scope below, dependency badges only when needed, no status menu or drag grip. Scoped views omit redundant scope text.
- Whole-card click/Enter opens details; pointer movement or Space starts dragging. Drops never open details, and production status writes retain revision capture, optimistic rollback, no-op drops, accessible announcements, and focus restoration. Pending or unconfirmed cards cannot drag. List stays non-draggable and the detail status picker remains available.
- Expanded footer uses full width, horizontal padding, and space-between alignment. Collapsed controls stay inside the rail. Save feedback has vertical spacing between filters and board.
- Archived prototype remains available as a primary source; preview scaffolding and memory-only writes are absent from production. Type checking, build, existing behavior coverage, and real browser checks pass.

## Implementation handoff

Prompt: [implementation-prompt-17.md](../implementation-prompt-17.md).

Prototype primary source: branch `prototype/compact-board-ui-2026-10-07`, finalized capture `795882e3e1bb53a937d308289a732ce92a7a8355` (initial capture `f03b163cd0e4fa68470e5cfd5169b4371693fc8d`). Files: `src/client/ui-prototype/PrototypeApp.tsx` and `scripts/ui-prototype.mjs`. Selected variant: A. The finalized capture includes footer and save-feedback refinements, which must be included in the implementation.

## Comments

### Layout verdict — 2026-10-07

- User selected A (compact cards). Preserve its full-width condensed title and small metadata row below; implement its whole-card interactions through the existing revision-protected status mutation.
- Footer refinement: status left, theme toggle right, full available width with horizontal padding; stack the controls in the collapsed rail.
- Give save feedback vertical spacing between the filters and board.
- User confirmed the recommended answers to Q1–Q3. These UI decisions supersede the card gutter, compact status menu, drag handle, and title-font choices in tickets 11 and 12. No glossary change or ADR is needed: these are reversible presentation choices, with no change to domain terms or status semantics.
- Preview implemented at `src/client/ui-prototype/PrototypeApp.tsx`, mounted on the existing route only through the development-only entry point. A uses individual cards, B uses full-width status lanes, and C groups cards within status columns. A floating switcher preserves query parameters and supports arrow keys outside text fields, dialogs, and active drags. State inspection shows the selected layout, navigation, and in-memory issue metadata. Self-hosted Roboto Condensed is a development dependency.
- The prototype branch includes the agreed shared picker, filter alignment, and connection/theme spacing fixes. Details keep their searchable status picker; preview status changes use a memory-only API, and other writes are rejected. Production implementation is a separate run, as requested in the design handoff.
- Verification: `pnpm typecheck`, `pnpm build`, and all 122 existing tests passed. The production bundle has no preview switcher, memory API, preview state logger, or Roboto Condensed assets. Real Brave verification covered all three layouts, light/dark mode, clicking the picker input, zero border/padding on the form chevron, mouse dragging without opening details, clicking card whitespace, Space/arrow/drop with restored focus, and Enter opening details. The source issue's Markdown status remained unchanged during simulated moves. Existing nonblocking build-size and jsdom scheduling warnings remain.
- Documentation checked against official Chakra combobox documentation (`openOnClick`) and dnd-kit draggable documentation, with installed 0.5.0 sensor types/implementation used for activation thresholds and keyboard codes. Context7 is unavailable in this session.
- Final footer and feedback refinements passed type checking and visual verification in Brave: the expanded footer places controls at opposite sides with horizontal padding, and the save result has vertical spacing between the toolbar and board. The earlier preview foundation passed the production build and all 122 existing tests; the final refinements only change layout spacing. No production implementation is marked complete in this ticket.

### Implementation result — 2026-10-07

- Implemented approved layout A in the real Board and DragBoard components, using the archived finalized capture `795882e3e1bb53a937d308289a732ce92a7a8355` as the visual source. Cards have full-width self-hosted Roboto Condensed titles, a small mono issue number/scope row, and dependency badges only when present. Scoped views omit the redundant feature/effort. Column headings and detail issue headings use the same title font; controls/body and paths/numbers retain IBM Plex Sans/Mono.
- Removed card status menus, their compact popover implementation, and drag grips in both views. Board cards open details from any ordinary click or Enter; mouse activation requires 6 pixels of movement, touch uses a 200 ms hold with 8 pixels of tolerance, and Space starts keyboard dragging. Arrows move, Space/Enter drops, and Escape cancels. List cards open by click/Enter/Space and have no draggable accessibility attributes. Details retain the searchable immediate-save status picker.
- Kept production pickup revision capture, authenticated `/api/status`, optimistic saves, rollback, announcements, focus restoration, and cancelled/same-column/outside drop no-ops. Activation checks current drag availability during writes/reloads and unconfirmed creation. Readable details remain accessible while dragging is paused, without falsely announcing the details button as disabled.
- Every shared picker opens from input clicks. The plain chevron has zero border and padding, including editing/creation forms; the broad form-button theme rule now excludes only combobox triggers. Filter actions use compatible small control heights, align with inputs rather than labels, and wrap. Footer controls span the padded expanded navigator with space-between alignment and stack/center inside the collapsed rail. Save/pending/error feedback has vertical padding between filters and board.
- The complete prototype remains on `prototype/compact-board-ui-2026-10-07`. The implementation started from clean production main: no losing variants, floating switcher, preview memory API, startup script, entry-point gate, or renderer injection was introduced. Production still uses the real authenticated API. No ADR, glossary, or status/domain semantics changed. Updated README and contributor interaction instructions to match the new controls.
- Verification: `pnpm typecheck`, `pnpm build`, and the full `pnpm test` suite passed (124 tests, including packed-package verification). Focused drag, picker, state, and live-refresh tests were run during implementation. Existing tests now use whole cards and the detail status picker while retaining disk/API coverage for status-only edits, stale pickup revisions, optimistic moves, rollback, disabled pending/creation states, focus, no-op drops, keyboard access, and live refresh. Added distinct whitespace-click/Enter opening and picker-input opening coverage, plus an assertion that Space cannot pick up a pending card.
- Real Brave verification used only temporary Markdown under `/tmp/mdboard-17-browser`: mouse dragging saved without opening details; keyboard Space/arrows/Enter saved with restored focus; List Space opened details; the detail picker saved status; editing/creation input clicks opened options and computed chevron border/padding were `0px`; title computed font was Roboto Condensed; light/dark appearances were inspected. The temporary launch issue returned byte-for-byte to its original content after the status round-trip. The expanded footer computed `space-between` with 12px horizontal padding for live and outdated text, and the collapsed footer occupied 35px inside the 52px rail. Clear and Reload shared the picker input bottom edge. The specifically flagged launch-status feedback has visible vertical breathing room. Stopping the fixture server and reloading verified offline/outdated feedback and Reload alignment.
- Code review: parallel Standards and Spec reviews against starting commit `718d9ab7c5fda302c588f90a318d5769698bfbf0`. Spec: no findings. Standards: one disabled-button accessibility concern corrected and re-reviewed; no outstanding findings.
- Limitations: touch hold is configured against the pinned dnd-kit API but was not checked on physical touch hardware. Existing nonblocking bundle-size, React/jsdom scheduling, and Node localStorage warnings remain. No push, merge, publication, or next implementation ticket is part of this work.

### Dependency details follow-up — 2026-10-07

- Fixed the reported dependency section in the issue details modal: replaced raw HTML relying on removed class styles with Chakra heading, text, and stack components. A top separator and spacing distinguish it from the status picker; advisory text is smaller and muted, dependency source text uses mono, and each linked issue/path/state or diagnostic has its own row. Dependency resolution, messages, and navigation are unchanged.
- Verified the empty state in the real browser using temporary Markdown, and ran the existing details, dependency status, and hidden-target navigation tests (3 passed), type checking, and production build.
- The user subsequently authorized opening a PR, squash-merging it, and making a new release; this supersedes the earlier no-push/no-merge/no-publication scope. Release preparation targets 0.1.1 because the registry already contains 0.1.0 from `f70372f`.

### Form action styling follow-up — 2026-10-07

- Fixed the global visual ambiguity between action buttons and dropdown fields by removing the broad form-button border rule and replacing remaining plain action buttons with Chakra buttons. Save/create/append actions are compact and filled; reload/recovery actions use subtle backgrounds, and clear/discard actions use quieter variants. Applied the same treatment to issue editing/creation, unavailable-file recovery, repairs, and supporting documents. Input fields and plain picker chevrons keep their existing styling; Write/Preview tabs now retain their own tab recipe.
- Added wrapping action rows with 16px top spacing in editing and creation; recovery/document actions also have explicit spacing. The helper text for original dependency metadata is smaller and muted. Submission, draft, and disabled-state logic is unchanged.
- Verification: type checking and production build passed; all 39 relevant interaction tests passed (board/forms, client recovery, navigator, repairs, documents). Real Brave checks verified distinct filled buttons versus bordered dropdowns, compact action widths, 16px reload-row spacing, normal tab borders, Preview/Reload behavior, and creation in light mode; editor checked in dark mode. Creation chevrons still compute zero padding/border. No browser writes were made during these checks, and the user's existing fixture draft was left open untouched.
- PR, merge, and release are on hold at the user's request. None has been created/published for this change. Uncommitted 0.1.1 release preparation was removed while paused; the package remains 0.1.0 until release work resumes.

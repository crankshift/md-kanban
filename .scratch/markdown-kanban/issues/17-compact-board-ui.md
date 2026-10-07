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

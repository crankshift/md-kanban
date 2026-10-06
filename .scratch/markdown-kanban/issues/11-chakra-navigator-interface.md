# 11: Rebuild the interface with Chakra UI as a navigator board

Status: ready-for-agent
Blocked by: 10

## Outcome

The board looks and works like the approved prototype (variant B): a collapsible navigator sidebar, columns or a list in the main area, issue and document details in a dialog over the board, and a command palette.

## Prototype reference

The prototype is the primary source for layout, copy, and interaction. It was approved with variant B and the orange palette. Run it with `pnpm prototype` before this ticket removes it; afterwards read it from history at commit `3a6620a` (`src/client/prototype/VariantB.tsx`, `shared.tsx`, `theme.ts`, `data.ts`). Rewrite it to production quality instead of promoting prototype code directly.

## Scope

- Set up Chakra UI v3 following its current `llms.txt` documentation: provider, colour mode through next-themes (light and dark, defaulting to the system setting), toaster, and a theme with an orange accent, neutral surfaces, compact density, IBM Plex Sans for text, and IBM Plex Mono only for ticket numbers and file paths. Remove `style.css`.
- Sidebar: product name and selected folder, a "Jump to…" button for the command palette, workflows with counts, Needs attention with a count, locations with their features or efforts, and supporting documents grouped as specifications, wayfinding maps, and decisions, plus live status and the colour-mode toggle. A button and the `[` key collapse it to an icon rail that keeps workflows, Needs attention, documents, search, live status, and colour mode reachable with tooltips.
- Main area: the current scope as the heading, a text filter, a Board/List toggle kept in the URL, and New issue. Board columns use full width; cards show the ticket number in a gutter, the title, the feature (when not already scoped), dependency badges, and a status menu. The list view groups rows by status in collapsible sections.
- Details open in a centered dialog with the issue content beside a metadata column (status, feature or effort, location, file, dependencies). Followed links stack inside the dialog with Back and a breadcrumb. Supporting documents render read-only in the same dialog.
- Command palette (⌘K or Ctrl+K) searches issues and documents and opens the chosen one.
- Every value picker is a Chakra combobox with type-to-filter; no native select menus remain. Markdown editing uses Write and Preview tabs that share one fixed-height frame, so switching never changes the dialog's size.
- Create issues in a dialog with feature or effort, status, title, and Markdown body.
- Feedback: successes as toasts; failures as persistent toasts plus an inline message where the user is working; live, offline, and outdated state as a status indicator; empty states that explain what to do. Remove the old help text and banner stack.
- Use "Feature" in implementation views and "Effort" in wayfinding views, matching `GLOSSARY.md`.
- Keep the existing status-change controls working; drag and drop arrives in ticket 12. The Needs attention view lists unrecognized issue candidates and opens them read-only; fixing them arrives in ticket 13.
- Make roles and accessible names the test contract; replace class-name selectors in tests.
- Remove the prototype: `src/client/prototype/`, `scripts/prototype-demo.mjs`, the `prototype` script, the prototype branch in `main.tsx`, and the prototype alias in `vite.config.ts`.

## Acceptance criteria

- The interface matches the approved prototype's structure in light and dark mode, and the main journeys work with keyboard only, with visible focus.
- Opening an issue or document never narrows the board columns.
- Collapsing and expanding the sidebar works by button and `[`; the rail keeps every destination reachable.
- Board and List show the same filtered issues, and the chosen view survives a reload.
- No native `<select>` element is rendered anywhere in the app.
- Switching between Write and Preview does not change the editor's height.
- All behavior from tickets 01–10 still works and its tests pass using role and label queries, along with type checking and the production build.
- The packed package contains no prototype files, and the production bundle contains no prototype code.

## Comments

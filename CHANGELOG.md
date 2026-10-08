# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-08

### Added

- A folder-oriented Markdown workspace with recursive `.md`/`.markdown` discovery, filename/title/body search, optional YAML/leading properties, clear metadata conflicts, and a persistent safe reader with backlinks and relative-link/fragment navigation.
- Read-only Boards grouped by any authored property or physical folder, with distinct missing, empty, literal, and conflicting values.
- Global and one-hop local document maps with Overview, Directed, and Folders layouts, explicit dependency-property selection, reciprocal directions, focus highlighting, and stable measured geometry while hovering or refreshing.

### Changed

- Documents and folder scopes now organize navigation independently of numbering, issue containers, workflows, or fixed status values. Existing editing, comments, creation, repair, and status writes remain available through optional issue tools with their existing safeguards.
- Live refresh covers all Markdown extensions, metadata, links, unavailable paths, and open readers. Unreadable/oversized files stay discoverable and directory access failures remain visible.
- Direct folder launches retain top-level files alongside nested document folders; folder expansion and map choices restore from the URL. Workspace controls and responsive layouts use the shared Chakra theme.

## [0.1.1] - 2026-10-07

### Changed

- Compact title-first cards with self-hosted Roboto Condensed titles and column headings, smaller issue metadata, and scoped feature/effort labels.
- Whole-card dragging with click/Enter to open details, Space to pick up by keyboard, and the searchable detail status picker as an alternative; removed card status menus and grips from Board and List.
- Searchable pickers open from input clicks and use plain chevrons in every form; filter actions align with inputs and wrap.
- Form actions use compact filled or text buttons, distinct from bordered dropdown fields; reload/discard rows have explicit spacing, and Write/Preview tabs no longer inherit generic button borders.
- Issue details separate dependency headings, advisory text, source paths, and dependency states with explicit spacing and typography.
- Padded connection/theme footer spreads across the sidebar and stacks inside the collapsed rail; save feedback has more vertical space.

## [0.1.0] - 2026-10-06

### Added

- Explicit repairs for Needs attention files: workflow-labelled status and Type choices, whole-file Markdown editing with preview, preserved unrelated content, and stale-write rejection.
- Mouse, touch, and keyboard dragging between status columns, with target highlighting, screen reader announcements, preserved issue order, and optimistic status saves that roll back on rejection.
- Local CLI and packaged browser app for a selected Markdown folder, with loopback access and clean shutdown.
- Discovery across `.scratch`, `docs`, features, efforts, and directly selected issue folders; separate implementation and wayfinding boards and Needs attention diagnostics.
- Issue details, safe Markdown previews, scoped dependencies, advisory blocker badges, search, and combined location/feature filters.
- Status changes, structured issue editing, comment append, and safe issue creation that preserve unrelated Markdown and reject stale file/container revisions.
- Live refresh of external edits, creations, renames, and deletions, with draft protection and watcher fallback.
- Read-only specifications, maps, and ADRs, with safe local links, fragments, and Back navigation.
- Restorable URL state for workflow, search, filters, open issue/document, and creation form, including browser Back and deep links.
- Failed-save recovery that can reopen submitted editor values after closure.

### Changed

- Renamed the package, command, page title, and interface to `mdboard`; the registry commands will be `npx mdboard` and `pnpx mdboard`. The app now writes hidden temporary and lock files as `.mdboard-*` and sends the `X-Mdboard-Session` header. The GitHub repository stays `md-kanban`.
- Rebuilt the interface as a Chakra navigator with an orange accent, system-aware light/dark modes, compact cards, and grouped Board/List views restored from the URL.
- Issue creation, reading, and editing now open in centered dialogs over the full-width board. Followed links retain Back history and breadcrumbs; a command palette searches issues and supporting documents.
- Added searchable comboboxes, fixed-height Write/Preview tabs, a collapsible sidebar/icon rail, and toast feedback for saves and rejected writes.
- Removed the throwaway prototype and its build/demo entry points. Status menus remain available as an alternative to dragging.
- File reads and writes now use one TanStack Query cache. Writes appear optimistically, roll back on failure, and pause refetches until settlement; creation shows no number until confirmation.
- Drafts belong only to their open editor. Closing asks to discard unsaved work; external conflicts show changed fields with discard/reapply recovery and extra confirmation for overlapping changes.
- Supporting Markdown documents now refresh through live file-change events.
- Packed installations require only `open` and `zod` at runtime; client libraries ship in prebuilt assets.

[Unreleased]: https://github.com/crankshift/md-kanban/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/crankshift/md-kanban/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/crankshift/md-kanban/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/crankshift/md-kanban/releases/tag/v0.1.0

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Local CLI and packaged browser app for a selected Markdown folder, with loopback access and clean shutdown.
- Discovery across `.scratch`, `docs`, features, efforts, and directly selected issue folders; separate implementation and wayfinding boards and Needs attention diagnostics.
- Issue details, safe Markdown previews, scoped dependencies, advisory blocker badges, search, and combined location/feature filters.
- Status changes, structured issue editing, comment append, and safe issue creation that preserve unrelated Markdown and reject stale file/container revisions.
- Live refresh of external edits, creations, renames, and deletions, with draft protection and watcher fallback.
- Read-only specifications, maps, and ADRs, with safe local links, fragments, and Back navigation.
- Restorable URL state for workflow, search, filters, open issue/document, and creation form, including browser Back and deep links.
- Failed-save recovery that can reopen submitted editor values after closure.

### Changed

- File reads and writes now use one TanStack Query cache. Writes appear optimistically, roll back on failure, and pause refetches until settlement; creation shows no number until confirmation.
- Drafts belong only to their open editor. Closing asks to discard unsaved work; external conflicts show changed fields with discard/reapply recovery and extra confirmation for overlapping changes.
- Supporting Markdown documents now refresh through live file-change events.
- Packed installations require only `open` and `zod` at runtime; client libraries ship in prebuilt assets.

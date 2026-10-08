# mdboard

A local Markdown workspace for finding, reading, and understanding documents and their relationships. Browse folders and files, group optional properties on a board, or explore a document map. Your Markdown files remain the source of truth.

## Run locally

Use Node.js 22.12 or newer:

```sh
npx mdboard /path/to/project
pnpm dlx mdboard /path/to/project
```

Omit the folder to use the current directory. `--no-open` prints a local URL without opening a browser. Keep the process running; Ctrl+C stops it. The app binds to loopback and serves its own bundled assets, never your selected folder as a static website.

## Find and read documents

Every launch indexes `.md` and `.markdown` recursively throughout the selected folder, including root files and arbitrary nested folders. Repository and directly selected folder launches use the same boundary. Filenames, numbering, metadata, and issue conventions do not determine membership.

Use the folder tree or narrow-screen **Folders** navigation and **Folder scope** picker to include a folder and its descendants. Search filenames, paths, titles, and Markdown body text. **Files**, **Board**, and **Map** share the filtered collection and a reading pane. File paths and optional properties stay visible. Navigation, search, filters, grouping, map settings, the open file, and fragments live in the URL; browser Back restores earlier reading.

Markdown renders safely without raw HTML. Relative Markdown links and heading fragments open in the reader; external links open a separate tab. Links may open allowed files elsewhere inside the selected boundary, but those files do not silently become indexed map nodes. Paths through symlinks and `.git` are refused. Eye controls hide or show folder subtrees across Files, Board, Map, and status discovery. Dependency/generated folders (`node_modules`, `vendor`, `.pnpm-store`, `dist`, `build`, `coverage`, `.cache`, `.next`) start hidden and can be revealed on demand; ordinary folders, including `.scratch`, `.agents`, and `.codex`, start visible. A hidden document can still be read through an explicit in-boundary link without revealing its folder or creating a map node. Hiding the selected scope moves it to the nearest visible ancestor. Visibility lives in the URL; fresh launch URLs use defaults. Unreadable files and files above the 2 MiB preview cap stay listed with an explanation; inaccessible directories report warnings.

External edits, creation, renames, deletion, and atomic replacement refresh files, metadata, relationships, and the reader. **live**, **offline**, and **outdated** identify connection and read state. Reload or return window focus to read disk again. A deleted open file stays selected with an unavailable message.

## Optional properties and Board

Properties are optional YAML frontmatter or a leading plain/bold property block, optionally after the title:

```md
---
Owner: Ada
Priority: curious
---
# Research note

**Status:** exploring
Type: research

The document body starts here.
```

Names and values belong to the author. Unknown status/type values are ordinary properties. YAML scalars retain their literal text; lists and objects display as values. Original occurrences and malformed/duplicate/conflicting metadata remain visible in the reader. Body prose and fenced examples are not leading properties.

**Board** groups by any property or physical folder, using values present in the files. Missing values, empty values, authored `No value`, and conflicting composite values remain distinct. The Value picker quotes authored literal values to keep them distinct from missing, empty, invalid, or conflicting metadata. An authored `Folder` property is separate from physical folder grouping. The default status board uses compact cards beside a reader. Status labels differing only in letter case share a column. Missing/blank statuses appear in the system **No status** group; conflicting/non-text statuses appear in **Check status**. Authored labels with these names are separate columns. Duplicate occurrences, even equal ones, disable structured moves with an explanation; **Edit** lets you deliberately correct the source.

Drag a card to change its status, or use **Change status** in the reader. Space picks up, arrows choose a column, Space/Enter drops, and Escape cancels. Pointer dragging lifts a same-size shadow card at the grab point, fades its source, and highlights the destination. Own-column, outside, and cancelled drops write nothing. Drops write the destination's spelling; dropping into system No status removes only the status property. Filters narrow cards while destinations remain available. **Add status** creates an empty destination without a file. Introduced and emptied columns survive view/filter/scope changes until reload, except contributions hidden by folder visibility. Reload rediscovers statuses from files. Column order implies no lifecycle or completion sequence; other property/folder boards remain read-only.

## Document maps

**Map** offers **Overview** (D3-Force), **Directed** (Dagre), and **Folders** presentations on a React Flow canvas. Pan and zoom with the canvas controls. Files without links remain discoverable. Click or keyboard-activate a file to read it.

Markdown links, including reference links, form directed relationships; the reader lists outgoing links and incoming backlinks separately. Under **Dependency settings**, select any authored property whose explicit file paths or Markdown links identify dependencies. Numeric references stay metadata. Dashed blue dependency edges remain distinct from document links. Folder membership and statuses imply neither dependency nor completion.

Selection or hover focuses connections while keeping other files visible; **All connections** restores every stroke. Reciprocal references share a display line with original directions retained. **Show neighborhood** displays one hop within the visible filtered scope, with separate incoming, outgoing, and two-way branches. Arrows show references, not work order.

## Optional document tools

Every readable in-boundary Markdown document offers explicit **Edit**, **Add comment**, and, for unambiguous metadata, **Change status**. Reading is the default. Numbering, Type, folder names, fixed statuses, and workflow classification are not prerequisites. Author-defined statuses never establish completion or dependency resolution.

**Edit** saves the full Markdown source deliberately, including metadata corrections; **Write** and **Preview** use the safe renderer. **Append comment** preserves existing sections and creates Comments when needed. Structured status moves preserve unrelated YAML/leading properties, comments, quoting, whitespace, line endings, body, and checkboxes. Every write checks the local session, origin, selected-folder boundary, regular-file/symlink rules, UTF-8, and expected revision.

**New issue** defaults to the current scope and works in any chosen folder, including empty folders. The suggested title-based filename is editable; a clear existing numbering pattern is continued. Status is optional, with folder-scoped suggestions and free text. A column's + button prefills its status, which remains editable/clearable. The generated file contains a title, optional Status, and optional body; no automatic Type, workflow, or dependency fields. Existing files are never overwritten.

**New folder** is available in folder navigation and the issue folder picker. It creates a real directory immediately under its chosen parent and remains if issue creation is cancelled.

Drafts stay in the open form. Closing or navigating away asks before discarding unsaved input. External edits never replace drafts. **Discard mine** and **Reapply mine on latest** provide explicit stale-edit recovery after reviewing the latest source. Failed submitted drafts can be reopened with **Recover failed draft**; recovery is session-only and does not survive reload. After a lost response, inspect refreshed Markdown before retrying, especially comments and creation. There are no automatic write retries.

Saves use sibling temporary files, locks, and atomic replacement. If an interrupted process leaves a `.mdboard-*.lock` or `.mdboard-create.lock`, stop all mdboard processes before removing the reported lock. See [contributor documentation](CONTRIBUTING.md#write-boundary) for filesystem assumptions and the final-check race with external editors.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, integration tests, map checks, and packed-package verification. Design records live in the [glossary](GLOSSARY.md), [ADRs](docs/adr/), and [workspace specification](.scratch/markdown-library/spec.md). The approved compact-card A prototype remains intact at `4ce592d` on `prototype/folder-status-boards-2026-10-08`. Production uses real filesystem writes and includes none of its simulation or comparison controls.

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

A repository launch indexes every `.md` and `.markdown` file recursively under `docs/` and `.scratch/`, including ordinary notes, archives, agent guidance, ADRs, specs, and issues. Existing top-level `issues/` and `tickets/` launches are supported too. Select a document folder directly to browse its descendants within that boundary. Filenames, numbering, metadata, and issue conventions do not determine membership.

Use the folder tree or the narrow-screen **Folder scope** picker to include a folder and its descendants. Search filenames, paths, titles, and Markdown body text. **Files**, **Board**, and **Map** share the filtered collection and a reading pane. File paths and optional properties stay visible. Navigation, search, filters, grouping, map settings, the open file, and fragments live in the URL; browser Back restores earlier reading.

Markdown renders safely without raw HTML. Relative Markdown links and heading fragments open in the reader; external links open a separate tab. Links may open allowed files elsewhere inside the selected boundary, but those files do not silently become indexed map nodes. Paths through symlinks and repository/dependency internals are refused. Unreadable files and files above the 2 MiB preview cap stay listed with an explanation; inaccessible directories report warnings.

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

**Board** groups by any property or physical folder, using values present in the files. Missing values, empty values, authored `No value`, and conflicting composite values remain distinct. An authored `Folder` property is separate from physical folder grouping. Columns are read-only and their order implies no lifecycle or completion sequence.

## Document maps

**Map** offers **Overview** (D3-Force), **Directed** (Dagre), and **Folders** presentations on a React Flow canvas. Pan and zoom with the canvas controls. Files without links remain discoverable. Click or keyboard-activate a file to read it.

Markdown links, including reference links, form directed relationships; the reader lists outgoing links and incoming backlinks separately. Under **Dependency settings**, select any authored property whose explicit file paths or Markdown links identify dependencies. Numeric references stay metadata. Dashed blue dependency edges remain distinct from document links. Folder membership and statuses imply neither dependency nor completion.

Selection or hover focuses connections while keeping other files visible; **All connections** restores every stroke. Reciprocal references share a display line with original directions retained. **Show neighborhood** displays one hop across the full collection, with separate incoming, outgoing, and two-way branches. Arrows show references, not work order.

## Optional issue tools

Generic views are read-only. Files recognized by the existing issue write contracts expose **Issue tools** for editing, comments, explicit repairs, and immediate status changes. **New issue** creates files only in existing containers whose supported conventions establish a workflow. These optional capabilities do not define document membership or generic property values.

Supported implementation statuses are `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`; supported wayfinding statuses are `open`, `claimed`, and `resolved`. Those vocabularies authorize existing writes only. Arbitrary document editing, arbitrary status writes, and workflow/schema authoring require a separate design.

Edits preserve unrelated Markdown, formatting, checkboxes, and comments. **Save issue** saves changed fields explicitly; **Append comment** writes only the new comment. **Write** and **Preview** use the safe renderer. Status changes save immediately. Every write checks the local session, origin, selected-folder boundary, discovered issue identity, and expected revision.

Drafts stay in the open form. Closing it or navigating away asks before discarding unsaved changes. External edits never replace a draft. **Reload issues, keep draft**, **Discard mine**, and **Reapply mine on latest** support stale-edit recovery; overlapping fields require confirmation. A failed save can offer **Reopen editor with submitted changes**. Drafts and failed-save recovery do not survive a page reload. After a lost write response, inspect refreshed Markdown before retrying, especially comments and creation.

Saves use sibling temporary files, locks, and atomic replacement. If an interrupted process leaves a `.mdboard-*.lock`, stop all mdboard processes before removing that issue's reported lock. See [contributor documentation](CONTRIBUTING.md#write-boundary) for filesystem assumptions and the final-check race with external editors.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, integration tests, map checks, and packed-package verification. Design records live in the [glossary](GLOSSARY.md), [ADRs](docs/adr/), and [workspace specification](.scratch/markdown-library/spec.md). The selected A design's complete throwaway prototype remains on `prototype/markdown-workspace-2026-10-07`; production includes only the folder explorer.

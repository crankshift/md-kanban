# mdboard

A Kanban board for Markdown tickets created with [Matt Pocock's agent skills](https://github.com/mattpocock/skills).

Open your project's tickets in a browser, see what needs attention, follow dependencies, and update tickets alongside your coding agent. Your Markdown files remain the source of truth.

## Run the local app today

Version 0.1.0 is complete and verified as a local package, but it is not on npm yet. Until it is published, run it from a checkout or install a packed tarball. The CLI, boards, dragging and status changes, issue creation, editing and comments, Needs attention fixes, dependency navigation, search, supporting documents, and live refresh of external changes all work today. Launch against a repository, tracker, feature, or issue folder to work with real issues in separate implementation and wayfinding views.

The installed CLI needs Node 22.12 or newer. Building from a checkout needs Node 22.22 or newer and pnpm 11.21.0:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start --no-open ./
```

Open the printed loopback URL. Omit `--no-open` to launch your default browser automatically; if opening fails, use the printed URL manually. Keep the terminal running, and press Ctrl+C to stop. An omitted folder defaults to the caller’s current directory. Relative folders resolve from that directory; invalid or inaccessible folders fail before startup.

To install and run the built package outside the checkout, follow the [packed-package instructions](CONTRIBUTING.md#packed-package-verification). This needs no registry access to mdboard.

Discovery includes `issues/` and `tickets/` containers under `.scratch` and `docs`, combining locations without duplicate paths. A directly selected issue folder can have any name. Cards show issue number, title, feature, and folder context, sorted by feature and number. Implementation columns describe triage readiness; wayfinding columns use `open`, `claimed`, and `resolved`.

Numbered Markdown filenames or numbered top-level headings identify issue candidates. Plain and bold metadata keys are supported. Missing, unknown, conflicting, or malformed metadata appears in **Needs attention**, with diagnostics and readable original Markdown. Specifications, maps, ADRs, generated assets, and dependency directories are excluded. Symbolic links inside the selected folder are skipped, including links to other folders inside it; explicitly selecting a symlinked folder uses its resolved target as the boundary.

Click a card to open its Markdown and comments in the detail dialog, with status, feature, location, and file context. Embedded HTML is ignored, script URLs are disabled, and Markdown checkboxes are read-only. Search titles and body text (including comments), then combine the query with location and feature/effort filters. Features with the same name in different locations have separate options; filtering preserves feature/number order. Close the panel with its Close button or Escape. Workflow, search, location, feature/effort, open issue or document, and the creation form are restored from URL search parameters. Share or reload that URL to restore the view; browser Back closes a newly opened panel or returns to the previous issue or document. Unsaved input is never included in the URL.

Dependencies resolve within the issue's feature/effort and location, across its `issues/` and `tickets/` containers. Comma-separated numbers, optionally followed by titles (for example `01 — Launch, 03: Review`), and `None` or `None (can start immediately)` are supported. Titles may contain commas; the next numbered reference starts a new dependency. Leading zeroes and an optional `#` do not affect number lookup. The original dependency text stays visible. Missing, ambiguous, and unsupported references show diagnostics; ambiguous numbers list the candidate paths without guessing a target. Click an unambiguous dependency to open its issue, even when the board filters hide it.

Dependency badges are advisory. A valid wayfinding prerequisite in `open` or `claimed` is an unresolved blocker; `resolved` stops blocking. Unknown prerequisite states remain visible. Implementation triage readiness never implies completion.

Drag a card by its grip handle to another status column with a mouse, or hold the handle briefly before moving with touch. With a keyboard, focus the handle, press Space or Enter to pick up, use arrow keys to move (Shift plus an arrow moves faster), and press Space or Enter to drop or Escape to cancel. The target column is highlighted and moves and save results are announced to screen readers. The card’s status menu and detail status picker remain available, including in List view. Same-column, outside-column, and cancelled drops write nothing; card order stays feature, then issue number. Changes save immediately to the original Markdown file, using only statuses in that issue's workflow. Dependencies do not prohibit transitions. Only the status value changes; metadata style, whitespace, line endings, unknown sections, checkboxes, and comments stay intact.

The board shows status moves, field saves, comments, and creation immediately while the server writes. Pending controls are disabled. A new issue displays **Creating…** without a number until the server confirms it. Failures roll the change back and report an error; stale writes also reload the latest issues for review. A lost response can follow a successful write, so inspect the refreshed Markdown before retrying, especially comments and creation. The local write API checks the app session, origin, selected-folder boundary, and expected file or container revision.

Saves use temporary files and per-issue locks, shared by mdboard processes. Normal saves and failures clean these up. If a process is interrupted during a save, a `.mdboard-*.lock` may remain beside the issue. Stop all mdboard processes before removing that issue's lock and restarting; a blocked save reports this recovery path. External editors do not participate in these locks; see the [write boundary and limitations](CONTRIBUTING.md#write-boundary) for the final-check race and filesystem assumptions.

Use the detail dialog's **Edit issue** form for title, status, dependencies, and Markdown body, then choose **Save issue**. These fields save together only when requested; the card's Change status control still saves immediately. Dependency options stay within the same feature/effort and location, across its containers, and exclude ambiguous numbers and the issue itself. Unchanged selections preserve original dependency text, including titles and no-dependency notes. **Clear dependencies** can remove unresolved references deliberately. The **Write** and **Preview** tabs share a fixed-height editor and use the same safe Markdown renderer as details.

The editable body spans the content after leading metadata and before `## Comments`. Existing comments and any sections following the Comments section remain read-only. **Append comment** saves only the new comment, creates `## Comments` if absent, and preserves prior comments and the body. Use `###` or deeper headings in a new comment; top-level section headings and unclosed code fences are rejected to keep comment boundaries intact. Documents with duplicate Comments sections or unclosed fences remain readable and direct you to edit the Markdown before using the form. Needs attention documents use the explicit fix panel below.

Unsaved fields and comment text exist only in the open editor. Closing it or navigating to another issue or document asks you to confirm discarding changes. **Reload issues, keep draft** reads disk without discarding the open draft. When the file changes, the editor lists which fields changed on disk and in your draft. **Discard mine** resets to disk; **Reapply mine on latest** carries only your changed fields onto the latest version, with extra confirmation for fields changed on both sides. A changed body replaces the whole editable body, so reconcile overlapping body edits before saving. A save that fails after you close the editor offers **Reopen editor with submitted changes**. Leaving or reloading the page warns about unsaved work; drafts and failed-save recovery do not survive a reload.

Choose **New issue** to select an existing feature/effort folder and its recognized workflow, then enter a title, initial status, Markdown body, and optional dependencies from that scope. Wayfinding issues also have a type picker. Every picker supports typing to filter available values. Preview uses the same safe Markdown rendering. **Create issue** allocates the next free number and follows an existing issue's filename separator, number padding, heading, metadata style, and line endings. The saved issue opens in details and immediately appears on its board and in search. Creation supports `.scratch`, supported `docs` containers, and directly selected issue folders. A folder must already contain a valid issue establishing the chosen workflow; empty or entirely unsupported folders have no guessed workflow.

Creation never replaces an existing file. Occupied numbers, including unreadable files, directories, and symbolic links, are reserved across the discovered feature/effort scope. A changed container rejects the loaded creation draft. **Reload containers, keep draft** explicitly loads the latest snapshot for review and retry. Closing creation or navigating away asks to discard unsaved inputs; confirmed closure clears the form. After a lost creation response, inspect the refreshed board before retrying: the file may already exist. A retry using the old snapshot is rejected. **Discard creation draft** clears entered content explicitly; drafts live only in this tab.

The board follows the files while the page stays connected: an agent or editor writing, creating, renaming, deleting, or atomically replacing an issue file updates the cards, details, dependency badges, and Needs attention list without a restart or page reload. A **live** status indicator confirms the connection; **offline** and **outdated** identify connection or refresh failures. Changes to issues and supporting Markdown documents invalidate the file data cache. Search text, location/feature filters, the workflow view, and the open issue stay as they are, and a change to one issue never touches another issue's draft.

Unsaved work is protected. If a file with a draft changes, the draft stays in its form with a notice that the file changed outside the app; saving it is still rejected as stale, so the external version is never overwritten. Review the latest Markdown, then use **Reapply mine on latest** as described above. If the file is removed or renamed, its draft stays in the open detail dialog as copyable text until you discard it or confirm closing; a renamed file appears as a new card, so reapply the changes there. A file that becomes malformed moves to **Needs attention** with its diagnostic and keeps the draft recoverable; if it is repaired, the draft returns to the form. An open issue without a draft simply follows its file. A creation form you have not touched follows new or changed folders; once you enter anything, the form keeps the loaded snapshot and warns that the folder changed, and the server rejects creating from it until you use **Reload containers, keep draft**. Your own saves do not produce false results: refreshes wait for a save in progress, and the notification an app write causes matches what was just saved.

If the connection drops, the status indicator shows **offline** and reconnects automatically (use **Reload issues** to read the files immediately). If a refresh cannot read the folder, the last data stays on screen with an **outdated** indicator. Press Ctrl+C to stop; the server closes its file watcher and every open connection. A browser allows only a handful of simultaneous connections per local address, and each open board tab holds one, so close extra tabs if the page stops responding.

### Fixing Needs attention files

Open a candidate from **Needs attention**. Choose a status labelled with its workflow, replace an unknown wayfinding Type, or remove a Type line that conflicts with an implementation status. **Apply fixes** saves all chosen metadata changes together, preserving every other byte. Missing Status is inserted beside existing metadata or below the title. Duplicate or malformed metadata, mismatched numbers, and other problems point to **Edit Markdown**, which opens the whole file in Write/Preview; **Save file** explicitly replaces its Markdown.

The server re-parses every save. A toast names the board when no diagnostics remain; otherwise the remaining problems stay visible. A pending repair previews the chosen content without declaring the file fixed. Failed repairs roll back and refresh the file, retaining your choices or raw draft while the dialog stays open. Stale repairs are rejected without overwriting external edits. Copy your changes, reset the choices or cancel Markdown editing, and reopen the latest file before retrying. Closing or navigating away with unsaved changes asks for confirmation. Unreadable files must first be made readable as UTF-8 outside the app.

### Navigator and keyboard navigation

The orange Chakra interface uses neutral surfaces and IBM Plex Sans, with IBM Plex Mono for issue numbers and paths. Light and dark modes follow your system by default; the sidebar’s colour-mode button overrides that preference. The navigator lists both workflows with counts, Needs attention, locations and their features or efforts, and grouped supporting documents. Its collapse button or **[** switches to an icon rail; the shortcut is ignored while typing. Rail tooltips identify workflows, Needs attention, documents, scopes, search, connection status, and colour mode.

Filter issue titles and bodies in the main area. **Board** and **List** use the same issues; List groups rows in collapsible status sections. View, sidebar, scope, filters, and open details are restored from the URL. Issue and document dialogs open over the board without narrowing columns; followed links retain Back history and a path breadcrumb. **Jump to…**, **Ctrl+K**, or **⌘K** opens a command palette for issue content and document titles/paths. Type to filter, use Arrow Down to reach results, then Tab or the arrow keys to navigate and Enter to open. Save successes appear as toasts; rejected writes produce persistent, dismissible toasts and inline errors while preserving drafts.

### Supporting documents

A **Supporting documents** section lists the specifications and wayfinding maps (`spec.md`, `specification.md`, `map.md`) beside each recognized issue container, plus every Markdown file in `docs/adr` when you launch from a repository root. Choose one to read its rendered Markdown in the centered dialog. The panel is read-only: it has no editing controls, never writes files, and the documents are never cards or Needs attention entries, so an ADR with `Status: proposed` stays a document.

Relative links in an issue or supporting document open in the dialog when the target is a Markdown file inside the selected folder. A link to a discovered issue opens that issue; **Back to issue** or **Back to previous document** returns to where you came from. `#section` links and `file.md#section` links scroll to the heading, using GitHub-style heading slugs; a missing section is reported and the document opens at the top. A missing target, a link outside the selected folder, a link through a symbolic link (even one that stays inside the folder), a non-Markdown file, an absolute path, or an unreadable file is reported as unavailable and is never read. Links starting with a scheme such as `https:` open in a new tab. Links in a body or comment preview stay inert so a draft cannot be navigated away.

Launching an issue folder directly exposes only documents inside that folder, so its parent's specification and the repository's ADRs are unavailable; a feature/effort folder exposes its own `spec.md`/`map.md`, and ADRs only if that folder is itself laid out like a repository root (contains `.git`, `.scratch`, or `docs`). A document is read from disk each time it opens, when the window regains focus, and when you choose **Reload document**; edits made outside the app also refresh open documents through live file-change events. Documents larger than 2 MiB are not displayed.

## Intended registry usage (unreleased)

**Not yet published:** mdboard is not on the npm registry yet, so these commands do not work. They describe how you will run it once it is published; until then, use [the local app](#run-the-local-app-today).

From your project or ticket folder, run either command:

```sh
npx mdboard
pnpx mdboard
```

The board will open in your browser using the current folder. To open a different folder, pass its path:

```sh
npx mdboard ./docs/tickets
pnpx mdboard ./docs/tickets
pnpx mdboard ../another-project/.scratch
```

Launching without a path is the same as passing `./`. Keep the terminal command running while you use the board.

## What the board does

- Find tickets in `.scratch`, `docs`, or a ticket folder you select.
- Show implementation and wayfinding tickets in separate boards using their existing statuses.
- Change status immediately by dragging with a mouse, touch, or the keyboard, or with searchable status pickers.
- Help you find work with search and feature/folder filters.
- Show dependencies and link directly to related tickets.
- Let you create and edit tickets, preview Markdown, and add comments.
- List files with missing or unknown metadata under Needs attention and let you fix them explicitly.
- Refresh when your agent changes files and protect your unsaved edits when changes conflict.
- Open related specs, maps, and architectural decisions from `docs/adr` alongside tickets.

Ticket edits save back to the original Markdown files, preserving unrelated content. Supporting documents such as ADRs are read-only.

The board uses your tickets' existing workflows. Implementation triage statuses describe readiness, rather than a separate Todo / In progress / Done lifecycle.

## Get involved

Have an idea or want to help build it? See [contributing](CONTRIBUTING.md) and the [v1 plan](.scratch/markdown-kanban/spec.md).

## License

[MIT](LICENSE).

# md-kanban

A Kanban board for Markdown tickets created with [Matt Pocock's agent skills](https://github.com/mattpocock/skills).

Open your project's tickets in a browser, see what needs attention, follow dependencies, and update tickets alongside your coding agent. Your Markdown files remain the source of truth.

## Run the local app today

The CLI, boards, safe status changes, issue creation, editing and comments, dependency navigation, and search are available from this checkout. Launch against a repository, tracker, feature, or issue folder to work with real issues in separate implementation and wayfinding views.

Use Node 22.12 or newer and pnpm 11.21.0:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start --no-open ./
```

Open the printed loopback URL. Omit `--no-open` to launch your default browser automatically; if opening fails, use the printed URL manually. Keep the terminal running, and press Ctrl+C to stop. An omitted folder defaults to the caller’s current directory. Relative folders resolve from that directory; invalid or inaccessible folders fail before startup.

To install and run the built package outside the checkout, follow the [packed-package instructions](CONTRIBUTING.md#packed-package-verification). No registry publication is needed.

Discovery includes `issues/` and `tickets/` containers under `.scratch` and `docs`, combining locations without duplicate paths. A directly selected issue folder can have any name. Cards show issue number, title, feature, and folder context, sorted by feature and number. Implementation columns describe triage readiness; wayfinding columns use `open`, `claimed`, and `resolved`.

Numbered Markdown filenames or numbered top-level headings identify issue candidates. Plain and bold metadata keys are supported. Missing, unknown, conflicting, or malformed metadata appears in **Needs attention**, with diagnostics and expandable original Markdown. Specifications, maps, ADRs, generated assets, and dependency directories are excluded. Symbolic links inside the selected folder are skipped, including links to other folders inside it; explicitly selecting a symlinked folder uses its resolved target as the boundary.

Click a card to open its Markdown and comments in the details panel, with status, feature, location, and file context. Embedded HTML is ignored, script URLs are disabled, and Markdown checkboxes are read-only. Search titles and body text (including comments), then combine the query with location and feature/effort filters. Features with the same name in different locations have separate options; filtering preserves feature/number order. Close the panel with its Close button or Escape.

Dependencies resolve within the issue's feature/effort and location, across its `issues/` and `tickets/` containers. Comma-separated numbers, optionally followed by titles (for example `01 — Launch, 03: Review`), and `None` or `None (can start immediately)` are supported. Titles may contain commas; the next numbered reference starts a new dependency. Leading zeroes and an optional `#` do not affect number lookup. The original dependency text stays visible. Missing, ambiguous, and unsupported references show diagnostics; ambiguous numbers list the candidate paths without guessing a target. Click an unambiguous dependency to open its issue, even when the board filters hide it.

Dependency badges are advisory. A valid wayfinding prerequisite in `open` or `claimed` is an unresolved blocker; `resolved` stops blocking. Unknown prerequisite states remain visible. Implementation triage readiness never implies completion.

Drag a card to another column, or use **Change status** on its card or in the details panel with a keyboard or touch device. Changes save immediately to the original Markdown file, using only statuses in that issue's workflow. Dependencies do not prohibit transitions. Same-column moves do not save priority ordering. Only the status value changes; metadata style, whitespace, line endings, unknown sections, checkboxes, and comments stay intact.

The board changes a card's column after the server confirms persistence. Pending controls are disabled, and errors are visibly reported. If another editor changes the issue after loading, the save is rejected and the board loads the latest issues for review before retrying. A lost save response also triggers a refresh; if the server cannot be reached, the board warns that displayed statuses may be outdated and directs you to reload. The local write API checks the app session, origin, selected-folder boundary, and expected file revision.

Saves use temporary files and per-issue locks, shared by md-kanban processes. Normal saves and failures clean these up. If a process is interrupted during a save, a `.md-kanban-*.lock` may remain beside the issue. Stop all md-kanban processes before removing that issue's lock and restarting; a blocked save reports this recovery path. External editors do not participate in these locks; see the [write boundary and limitations](CONTRIBUTING.md#write-boundary) for the final-check race and filesystem assumptions.

Use the details panel's **Edit issue** form for title, status, dependencies, and Markdown body, then choose **Save issue**. These fields save together only when requested; the card's Change status control still saves immediately. Dependency options stay within the same feature/effort and location, across its containers, and exclude ambiguous numbers and the issue itself. Unchanged selections preserve original dependency text, including titles and no-dependency notes. **Clear dependencies** can remove unresolved references deliberately. Body preview uses the same safe Markdown renderer as details.

The editable body spans the content after leading metadata and before `## Comments`. Existing comments and any sections following the Comments section remain read-only. **Append comment** saves only the new comment, creates `## Comments` if absent, and preserves prior comments and the body. Use `###` or deeper headings in a new comment; top-level section headings and unclosed code fences are rejected to keep comment boundaries intact. Documents with duplicate Comments sections or unclosed fences remain readable and direct you to edit the Markdown before using the form. Needs attention documents have no structured fields.

Unsaved fields and comment text stay with their issue when you close the panel or navigate, with draft buttons for returning to them. **Reload issues, keep draft** reads disk without discarding drafts. Rejected or unconfirmed saves retain drafts and try to load the latest version. Review the latest Markdown, then use **Recover draft on latest version** to carry only your changed fields onto that version before saving. A changed body replaces the whole editable body, so reconcile overlapping external body edits manually. After a lost comment response, inspect existing comments before recovery and retry to avoid adding the same comment again. **Discard draft** explicitly resets to the loaded version. Drafts live only in this browser tab; leaving the page prompts a warning, and you should save or copy them first. Removed/unsupported issues retain a copyable draft.

Choose **New issue** to select an existing feature/effort folder and its recognized workflow, then enter a title, initial status, Markdown body, and optional dependencies from that scope. Wayfinding issues also have a Type selector. Preview uses the same safe Markdown rendering. **Create issue** allocates the next free number and follows an existing issue's filename separator, number padding, heading, metadata style, and line endings. The saved issue opens in details and immediately appears on its board and in search. Creation supports `.scratch`, supported `docs` containers, and directly selected issue folders. A folder must already contain a valid issue establishing the chosen workflow; empty or entirely unsupported folders have no guessed workflow.

Creation never replaces an existing file. Occupied numbers, including unreadable files, directories, and symbolic links, are reserved across the discovered feature/effort scope. A changed container rejects the loaded creation draft. **Reload containers, keep draft** explicitly loads the latest snapshot for review and retry. Closing creation or navigating to existing issues retains its draft and existing editor drafts. After a lost creation response, inspect the refreshed board before retrying: the file may already exist. A retry using the old snapshot is rejected. **Discard creation draft** clears entered content explicitly; drafts live only in this tab.

Reload issues or the page to discover external changes outside save recovery. Automatic refresh and supporting-document navigation follow in later slices.

## Intended registry usage (unreleased)

**Under development:** the app and CLI are not released yet. The commands below describe how you will use md-kanban once it is published.

From your project or ticket folder, run either command:

```sh
npx md-kanban
pnpx md-kanban
```

The board will open in your browser using the current folder. To open a different folder, pass its path:

```sh
npx md-kanban ./docs/tickets
pnpx md-kanban ./docs/tickets
pnpx md-kanban ../another-project/.scratch
```

Launching without a path is the same as passing `./`. Keep the terminal command running while you use the board.

## What the board will do

- Find tickets in `.scratch`, `docs`, or a ticket folder you select.
- Show implementation and wayfinding tickets in separate boards using their existing statuses.
- Let you drag tickets between status columns.
- Help you find work with search and feature/folder filters.
- Show dependencies and link directly to related tickets.
- Let you create and edit tickets, preview Markdown, and add comments.
- Refresh when your agent changes files and protect your unsaved edits when changes conflict.
- Open related specs, maps, and architectural decisions from `docs/adr` alongside tickets.

Ticket edits will save back to the original Markdown files, preserving unrelated content. Supporting documents such as ADRs will be read-only in the first release.

The first release will use your tickets' existing workflows. Implementation triage statuses describe readiness, rather than a separate Todo / In progress / Done lifecycle.

## Get involved

Have an idea or want to help build it? See [contributing](CONTRIBUTING.md) and the [v1 plan](.scratch/markdown-kanban/spec.md).

## License

[MIT](LICENSE).

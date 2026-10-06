# md-kanban

A Kanban board for Markdown tickets created with [Matt Pocock's agent skills](https://github.com/mattpocock/skills).

Open your project's tickets in a browser, see what needs attention, follow dependencies, and update tickets alongside your coding agent. Your Markdown files remain the source of truth.

## Run the local app today

The CLI and read-only boards are available from this checkout. Launch against a repository, tracker, feature, or issue folder to read real issues in separate implementation and wayfinding views.

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

This slice reads files only. Reload the page to discover external changes. Issue details, dependency navigation, search/filters, editing, and automatic refresh follow in later slices.

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

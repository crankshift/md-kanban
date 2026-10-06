# Publish as mdkanban

The app will be published to npm, and named everywhere, as `mdkanban`, although the repository is `md-kanban`. The name `md-kanban` was already taken on npm by an unrelated Markdown Kanban tool. We chose `mdkanban` instead of the previously proposed `mdboard` to keep the Markdown Kanban name without the hyphen. We rejected the scoped `@crankshift/md-kanban` because it is too long to type at every launch. The package, bin, and product share one name so `npx mdkanban`, a global install, and the documentation all agree. Issue 15 must confirm registry availability before publication.

## Consequences

- The GitHub repository keeps the name `md-kanban`, and `package.json` links to it.
- Hidden files the app writes beside issues use the `.mdkanban-` prefix.

# Publish as mdboard

The app is published to npm, and named everywhere, as `mdboard`, although the repository is `md-kanban`. The name `md-kanban` was already taken on npm by an unrelated Markdown Kanban tool, so the documented `npx md-kanban` would have launched someone else's package. `npx` and `pnpx` resolve the command as a package name, so the package name is what users type. We rejected the scoped `@crankshift/md-kanban` because it is too long to type at every launch, and `mdkanban` because npm refuses new names that match an existing one once punctuation is removed. The package, bin, and product share one name so `npx mdboard`, a global install, and the documentation all agree.

## Consequences

- The GitHub repository keeps the name `md-kanban`, and `package.json` links to it.
- Hidden files the app writes beside issues use the `.mdboard-` prefix.

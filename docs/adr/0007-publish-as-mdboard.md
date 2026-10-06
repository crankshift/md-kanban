# Publish as mdboard

The app will be published to npm, and named everywhere, as `mdboard`, although the GitHub repository is `md-kanban`. This supersedes [ADR 0006](0006-publish-as-mdkanban.md). Publishing `mdkanban` failed with `403 Forbidden - Package name too similar to existing package md-kanban`: npm rejects a name that equals an existing package once `-`, `_`, and `.` are removed, so the unhyphenated `mdkanban` collides with the unrelated `md-kanban`. An earlier registry check had looked up only the exact name, so it missed the collision. npm suggested the scoped `@crankshift/mdkanban`, but we rejected it again, for the reason ADR 0006 rejected `@crankshift/md-kanban`: it is too long to type at every launch. We chose `mdboard`, the name proposed before ADR 0006. On 2026-10-06 the registry had no `mdboard` package and no variant with `-`, `_`, or `.` inserted at any position. An unrelated `mdboard` was fully unpublished on 2026-03-24, and npm allows such a name to be reused after 24 hours. Only a successful publish proves the registry accepts the name, so ticket 15 still has to confirm it.

## Consequences

- The package, bin, page title, interface heading, and documentation all use `mdboard`, so `npx mdboard`, `pnpx mdboard`, and a global install agree.
- The GitHub repository keeps the name `md-kanban`, and `package.json` links to it.
- Hidden files the app writes beside issues use the `.mdboard-` prefix, and the session header is `X-Mdboard-Session`. No release used the `.mdkanban-` prefix or the `X-Mdkanban-Session` header, so the old names need no compatibility handling.
- Version `0.1.0` was never published, so the rename belongs to the `0.1.0` release rather than a later one.

# 14: Rename the package and product to mdkanban

Status: ready-for-agent
Blocked by: 13

## Outcome

The app is published under the name `mdkanban`, so `npx mdkanban` and `pnpx mdkanban` will launch it once it is on the registry. The package, CLI, interface, and documentation use one name. See [ADR 0006](../../../docs/adr/0006-publish-as-mdkanban.md).

## Scope

- Rename the package and its bin to `mdkanban` in `package.json`.
- Add registry metadata to `package.json`:
  - `repository`: `git+https://github.com/crankshift/md-kanban.git`
  - `homepage`: `https://github.com/crankshift/md-kanban#readme`
  - `bugs`: `https://github.com/crankshift/md-kanban/issues`
  - `author`: `crankshift`
  - `keywords`: `markdown`, `kanban`, `issues`, `agents`, `cli`, `mattpocock`, `agent-skills`, `claude-code`, `to-tickets`, `to-spec`, `wayfinder`, `triage`, `tickets`
- Rename user-visible text: CLI usage and log lines, error messages that name the app, the page `<title>`, and the header `<h1>`.
- Rename the hidden files the app writes beside issues from `.md-kanban-*` to `.mdkanban-*` (temporary files, per-issue save locks, and the creation lock), including the watcher's and creation's filters that ignore them. No release used the old prefix, so the old names need no compatibility handling.
- Rename the session header from `X-Md-Kanban-Session` to `X-Mdkanban-Session` on both server and client.
- Update tests that reference the old name.
- Update the README and CONTRIBUTING to the new name. Registry commands become `npx mdkanban` and `pnpx mdkanban`, still marked as unreleased. The GitHub repository keeps the name `md-kanban`, so repository URLs stay unchanged.
- Update the CLI line in `.scratch/markdown-kanban/spec.md` to `pnpx mdkanban` and `pnpx mdkanban ./`. Leave earlier tickets and saved prompts unchanged as historical records.
- Add the rename to the `Unreleased` section of `CHANGELOG.md`.

## Acceptance criteria

- `pnpm pack` produces `mdkanban-<version>.tgz` whose bin is `mdkanban`, and the installed command launches the app.
- No source, test, README, or CONTRIBUTING reference to `md-kanban` remains other than the GitHub repository URL and name.
- Saves and creations write and clean up `.mdkanban-*` files, and the watcher ignores them.
- Writes without the `X-Mdkanban-Session` header are rejected.
- Type checking, the production build, and the tests pass.

## Comments

### Implementation result — 2026-10-06

- Renamed the package and bin to `mdkanban` and added `author`, `repository`, `homepage`, `bugs`, and the thirteen `keywords` to `package.json`. Repository URLs keep the `md-kanban` GitHub name.
- Renamed the CLI usage and log lines, the page `<title>`, and the header `<h1>`. Hidden files are now `.mdkanban-*` (save temporaries, per-issue locks, creation lock), including error messages and the watcher and creation filters. The session header is `X-Mdkanban-Session` on server and client. No compatibility handling for the old names, as the ticket specifies.
- Updated tests, README, CONTRIBUTING, and the Unreleased CHANGELOG. The spec's CLI line already read `pnpx mdkanban` / `pnpx mdkanban ./`, so it needed no change. Earlier tickets and saved prompts are untouched.
- Verification: `pnpm typecheck`, `pnpm build`, and `pnpm test` (122 tests) passed. `pnpm pack` produces `mdkanban-0.1.0.tgz` whose `package.json` has bin `mdkanban`; an offline install into a scratch project ran `mdkanban --help` correctly (the package test also launches the installed bin). A grep finds `md-kanban` only in the GitHub URLs in `package.json` and CONTRIBUTING.
- Housekeeping: the ticket 13 checkbox in the implementation workflow was left unchecked by its commit; it is checked here since that ticket's work and comments are complete.
- Limitations: `pnpm-lock.yaml` has no package-name reference, so it is unchanged. Registry availability of `mdkanban` is not checked here; ticket 15 must confirm it. Not published.

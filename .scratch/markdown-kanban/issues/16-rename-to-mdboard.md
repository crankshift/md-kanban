# 16: Rename the package and product to mdboard

Status: ready-for-agent
Blocked by: 09

## Outcome

The app is published under the name `mdboard`, so `npx mdboard` and `pnpx mdboard` will launch it once it is on the registry. The package, CLI, interface, and documentation use one name again.

## Why

Publishing `mdkanban` 0.1.0 (ticket 15) failed with `403 Forbidden - Package name too similar to existing package md-kanban`. npm rejects a name if it equals an existing package once `-`, `_`, and `.` are removed, and `mdkanban` collides with the unrelated `md-kanban`. Nothing was published. npm suggested the scoped `@crankshift/mdkanban`, but it is too long to type at every launch, the same reason ADR 0006 rejected `@crankshift/md-kanban`.

`mdboard` was the name proposed before ADR 0006. On 2026-10-06 the registry had no `mdboard` package, and no variant with `-`, `_`, or `.` inserted at any position existed. A previous, unrelated `mdboard` was fully unpublished on 2026-03-24. npm allows a fully unpublished name to be reused after 24 hours, but only a successful publish proves the name is accepted.

## Branch

Implement this on its own branch, `feat/rename-to-mdboard`, created from `main`. The v1 feature branch is already merged. Open a pull request into `main` and squash-merge it once checks pass. The squashed commit is what ticket 15 tags and publishes.

## Scope

- Rename the package and its bin from `mdkanban` to `mdboard` in `package.json`. Keep the version at `0.1.0`, since 0.1.0 was never published. Keep `repository`, `homepage`, `bugs`, `author`, and `keywords` unchanged, because the GitHub repository stays `md-kanban`.
- Rename user-visible text: CLI usage and log lines, error messages that name the app, the page `<title>`, and the navigator heading.
- Rename the hidden files the app writes beside issues from `.mdkanban-*` to `.mdboard-*` (temporary files, per-issue save locks, and the creation lock), including the watcher's and creation's filters that ignore them. No release used the old prefix, so the old names need no compatibility handling.
- Rename the session header from `X-Mdkanban-Session` to `X-Mdboard-Session` on both server and client.
- Rename the temporary fixture prefix in tests, and update tests that reference the old name.
- Update the README and CONTRIBUTING to the new name. Registry commands become `npx mdboard` and `pnpx mdboard`, still marked as unreleased.
- Record the decision: add ADR 0007 (publish as mdboard) explaining the npm rejection and why the scoped name was rejected again, and mark ADR 0006 as superseded by it.
- Update the product name and CLI lines in `.scratch/markdown-kanban/spec.md` to `mdboard`. Leave tickets 01–14 and 09, and their saved prompts, unchanged as historical records.
- Add the rename to the `Unreleased` section of `CHANGELOG.md`. Since 0.1.0 was never published, fold it into the `0.1.0` section instead if that reads more accurately. In particular, the existing `mdkanban` rename line should name `mdboard`.

## Acceptance criteria

- `pnpm pack` produces `mdboard-0.1.0.tgz` whose bin is `mdboard`, and the installed command launches the app from outside the checkout.
- No source, test, README, or CONTRIBUTING reference to `mdkanban` remains. `md-kanban` remains only in the GitHub repository URL and name.
- Saves and creations write and clean up `.mdboard-*` files, and the watcher ignores them.
- Writes without the `X-Mdboard-Session` header are rejected.
- `npm publish --dry-run` from a clean checkout reports `mdboard@0.1.0`.
- Type checking, the production build, and the tests pass.
- The change is merged into `main` through a squashed pull request.

## Out of scope

- Publishing to npm and tagging the release. Ticket 15 does both after this merges.
- Renaming the GitHub repository.

## Comments

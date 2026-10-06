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

### Implementation result — 2026-10-06

- Renamed the package and bin to `mdboard` in `package.json`; the version stays `0.1.0`. `repository`, `homepage`, `bugs`, `author`, and `keywords` are unchanged, so the GitHub name stays `md-kanban`.
- Renamed the CLI usage and log lines, error messages that name the app, the page `<title>`, and the navigator heading. Hidden files are now `.mdboard-*` (save temporaries, per-issue locks, the creation lock), including the watcher and creation filters. The session header is `X-Mdboard-Session` on the server and the client. There is no compatibility handling for the old names.
- Renamed the temporary fixture prefixes and the references in the tests. Updated the README, CONTRIBUTING, and the product name and CLI lines in `spec.md`. The registry commands are `npx mdboard` and `pnpx mdboard`, still marked as unreleased.
- Added ADR 0007 (publish as mdboard) and marked ADR 0006 as superseded by it with a `Status:` line. The ADR 0006 file keeps its name as a historical record.
- Folded the rename into the existing `0.1.0` section of `CHANGELOG.md`, since 0.1.0 was never published. The `mdkanban` line now names `mdboard`.
- Tickets 01–14 and their saved prompts are unchanged, as are tickets 09 and 15. The implementation workflow checkbox for this ticket is checked.
- Verification:
  - `pnpm typecheck`, `pnpm build`, and `pnpm test` (122 tests) passed.
  - `pnpm pack` produced `mdboard-0.1.0.tgz` with bin `mdboard`. Its contents are `package.json`, `README.md`, `LICENSE`, `dist/server/*.js`, and `dist/client`. None of it mentions `mdkanban`.
  - An offline `pnpm add` of the tarball into a scratch project outside the checkout installed `node_modules/.bin/mdboard`. `mdboard --help` printed `Usage: mdboard ...`, and a launch against a portable fixture served `<title>mdboard</title>`.
  - A clean local clone of the commit, after `pnpm install --frozen-lockfile`, ran `npm publish --dry-run --access public` and reported `mdboard@0.1.0` with tag `latest` (35 files, 653.8 kB). Nothing was uploaded.
  - A grep finds no `mdkanban` in `src`, `tests`, `README.md`, `CONTRIBUTING.md`, or `package.json`. `md-kanban` remains only in the GitHub URLs in `package.json` and CONTRIBUTING.
  - The diff of `src`, `tests`, and `package.json` is symmetric once `mdkanban` and `mdboard` are normalized, so there are no behavior changes.
  - Tests cover rejection of writes with a missing or wrong `X-Mdboard-Session` header, and creation of `.mdboard-create.lock` and the status lock under the new prefix.
- Limitations:
  - The registry has not accepted `mdboard`. `npm publish --dry-run` does not contact the registry's name-similarity check, so only the real publish proves the name works.
  - The branch is not pushed, no pull request is open, and the work is not merged. The acceptance criterion about the squashed pull request is pending the user.
- Next ticket (15):
  - After the squash merge, `v0.1.0` must move to the squash commit. The old tag on `2172e20` names `mdkanban`; delete it locally and on `origin`, then retag.
  - Check that `npm view mdboard` returns a 404 or only an unpublished record, then publish from a clean checkout of the tag, then remove the README's "unreleased" wording.

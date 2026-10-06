# 15: Publish mdboard 0.1.0 to npm

Status: ready-for-human
Blocked by: 09, 16

## Outcome

Anyone can run `npx mdboard` or `pnpx mdboard` to launch the board, and the published version matches a tagged commit on `main`.

## Why a human

Publishing needs an npm login with two-factor authentication, and it merges and pushes to the shared repository. Ticket 09 deliberately excludes both.

## Steps

1. Log in to npm with an account that has two-factor authentication enabled (`npm login`, then check with `npm whoami`).
2. Confirm that `mdboard` is still free on the registry (`npm view mdboard` returns 404 or only an unpublished record). A 404 does not prove npm accepts the name; see the comments.
3. After ticket 16's squashed pull request is merged into `main`, move `v0.1.0` to that commit: delete the old tag locally and on `origin`, tag the squash commit `v0.1.0`, and push the tag. The old tag points to a commit named `mdkanban` that was never published.
4. From a clean checkout of the tag, run `pnpm install --frozen-lockfile`, then `npm publish --access public`. `prepack` runs type checking and the build. Publish `0.1.0` under the `latest` dist-tag. With a passkey-only account, npm prints an authentication link to approve in the browser; run it in your own terminal.
5. From an empty temporary folder outside the checkout, run `npx mdboard@0.1.0 --no-open <fixture>` and `pnpx mdboard@0.1.0 --no-open <fixture>` against a portable fixture, and check that the board loads.
6. Remove the README's "Intended registry usage (unreleased)" wording, so the registry commands are presented as released, and commit that on `main`.

## Acceptance criteria

- `npm view mdboard version` reports `0.1.0`, and the package page links to the GitHub repository.
- `npx mdboard` and `pnpx mdboard` launch the board from a folder with no checkout or prior install.
- The `v0.1.0` tag on `origin` points to the commit the package was published from.
- The README no longer describes the registry commands as unreleased.

## Out of scope

- Publishing from CI with npm trusted publishing and provenance. The package has to exist on the registry before a trusted publisher can be configured, so that belongs in a later ticket.

## Comments

### Publication attempt — 2026-10-06

- Ticket 09 finished. `feat/md-kanban-v1` was squash-merged into `main` through pull request #1 (`2172e20`), and the annotated tag `v0.1.0` was pushed to `origin` on that commit.
- The account `crankshift` has two-factor authentication for login and writes, using a passkey only, so there is no one-time password. `pnpm publish --otp` therefore cannot be used. `npm publish --access public`, run in the user's own terminal from a clean checkout of the tag, printed an authentication link that worked with the passkey.
- The registry then rejected the upload: `403 Forbidden - PUT https://registry.npmjs.org/mdkanban - Package name too similar to existing package md-kanban; try renaming your package to '@crankshift/mdkanban'`. The earlier 404 from `npm view mdkanban` checked only the exact name. npm also rejects names that match an existing package once `-`, `_`, and `.` are removed. Nothing was published.
- The scoped name was rejected as too long to type. The user chose `mdboard`; ticket 16 renames the package on its own branch. This ticket now publishes `mdboard` and is blocked by 16. The steps and acceptance criteria above have been updated, including moving `v0.1.0` to the squashed rename commit.

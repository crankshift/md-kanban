# 15: Publish mdkanban 0.1.0 to npm

Status: ready-for-human
Blocked by: 09

## Outcome

Anyone can run `npx mdkanban` or `pnpx mdkanban` to launch the board, and the published version matches a tagged commit on `main`.

## Why a human

Publishing needs an npm login with two-factor authentication, and it merges and pushes to the shared repository. Ticket 09 deliberately excludes both.

## Steps

1. Log in to npm with an account that has two-factor authentication enabled (`npm login`, then check with `npm whoami`).
2. Confirm that `mdkanban` is still free on the registry (`npm view mdkanban` returns 404).
3. Merge `feat/md-kanban-v1` into `main`, tag the merge commit `v0.1.0`, and push `main` and the tag to `origin`.
4. From a clean checkout of the tag, run `pnpm install --frozen-lockfile`, then `pnpm publish --access public`. `prepack` runs type checking and the build. Publish `0.1.0` under the `latest` dist-tag.
5. From an empty temporary folder outside the checkout, run `npx mdkanban@0.1.0 --no-open <fixture>` and `pnpx mdkanban@0.1.0 --no-open <fixture>` against a portable fixture, and check that the board loads.
6. Remove the README's "Intended registry usage (unreleased)" wording, so the registry commands are presented as released, and commit that on `main`.

## Acceptance criteria

- `npm view mdkanban version` reports `0.1.0`, and the package page links to the GitHub repository.
- `npx mdkanban` and `pnpx mdkanban` launch the board from a folder with no checkout or prior install.
- The `v0.1.0` tag on `origin` points to the commit the package was published from.
- The README no longer describes the registry commands as unreleased.

## Out of scope

- Publishing from CI with npm trusted publishing and provenance. The package has to exist on the registry before a trusted publisher can be configured, so that belongs in a later ticket.

## Comments

# Contributing to md-kanban

Start with the [v1 specification](.scratch/markdown-kanban/spec.md), [glossary](GLOSSARY.md), and [architectural decisions](docs/adr/). The current slice launches a local app with discovery, read-only boards, safe Markdown details, dependency navigation, and search/filters.

## Setup and checks

Use Node 22.12 or newer and pnpm 11.21.0 (the version pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

`pnpm check` runs type checking, the production build, and the full test suite. Tests launch real loopback servers and install a tarball into temporary directories. The packed-package test uses the pnpm store offline after `pnpm install`; it requires permission to bind local ports. Parser/discovery/dependency checks use portable temporary Markdown fixtures. UI checks render both workflows and attention diagnostics through React, and exercise real search/filter and details/dependency interactions with React `act` and jsdom. No private issue fixtures are needed. After changing server/shared modules, rebuild before running individual test files because they import `dist/server`.

## Local development

```sh
pnpm dev --no-open ./
```

This builds both TypeScript server code and the Vite frontend, then launches the real CLI. It has no file watcher yet; after source changes, stop with Ctrl+C and rerun. For an existing build:

```sh
pnpm start --no-open ./
```

For caller-cwd behavior, run `node /path/to/checkout/dist/server/cli.js --no-open` from another directory. Replace the example path with your checkout. Frontend assets are resolved beside the installed server, never from the selected folder.

## Packed-package verification

This POSIX shell recipe builds and installs the local package without publishing:

```sh
verification_dir=$(mktemp -d)
pnpm pack --out "$verification_dir/md-kanban.tgz"
mkdir "$verification_dir/installation" "$verification_dir/issues"
cd "$verification_dir/installation"
printf '{"private":true}\n' > package.json
pnpm add --offline --ignore-scripts "$verification_dir/md-kanban.tgz"
./node_modules/.bin/md-kanban --no-open "$verification_dir/issues"
```

Open the printed URL. Confirm the project name, selected folder, empty implementation columns, and workflow switching. To see a real card, create `01-example.md` in the temporary `issues` folder with `# 01: Example` and `Status: ready-for-agent` on separate lines, then reload. Open the card, read its Markdown, and try searching and filtering. Add another numbered issue with `Blocked by: 01 — Example` to verify dependency navigation. Press Ctrl+C to stop. Remove the temporary directory with `rm -rf "$verification_dir"` after inspecting it. `pnpm pack` runs type checking and rebuilds the package automatically; its file allowlist includes compiled assets and public documentation only.

## Discovery boundary

`GET /api/issues` returns issues and directory warnings within the launch root. Each issue carries a root-relative path identity, container, feature/location context, diagnostics, original Markdown, and SHA-256 content revision for future stale-write checks. The parser validates metadata using Zod; invalid candidates stay outside both workflows. Metadata is read from the leading block, so body examples and comments do not change status. This slice provides no write API.

Repository discovery traverses supported `.scratch` and `docs` trees; tracker/feature launches find nested `issues` and `tickets` containers, and direct issue folders read numbered candidates. Discovery skips symlinks, ADRs, supporting-document filenames, generated assets, and dependency directories. Failed issue reads become attention entries; failed directory reads become warnings. Files are read anew on each page reload; file watching belongs to a later ticket.

`src/server/dependencies.ts` is pure shared read logic: resolve numbers within feature/location context using the entire discovered board, rather than filtered cards, and retain ambiguous/missing/unsupported references. Only a valid wayfinding prerequisite's `resolved` state establishes resolution; implementation references remain advisory. `Board.tsx` selects issues by path identity and composes case-insensitive search with location and scoped feature filters. `IssueDetails.tsx` renders the preserved document, including comments, with `react-markdown`/`remark-gfm`, `skipHtml`, and the library's safe URL transform. Do not add raw-HTML plugins or disable URL sanitization. The original-text view remains available for diagnostics. Supporting-document links are deferred to ticket 08.

## Proposing changes

Open an issue at [crankshift/md-kanban](https://github.com/crankshift/md-kanban/issues) to discuss a bug, design change, or feature proposal. Internal specifications and implementation issues live in `.scratch/` according to [the tracker conventions](docs/agents/issue-tracker.md).

Keep pull requests focused on one change. Describe the resulting behavior and checks. Changes to issue parsing or editing should demonstrate that unrelated Markdown is preserved and stale writes are rejected. If a proposal changes an architectural decision, identify the existing ADR and explain why.

## Working with agents

Read [AGENTS.md](AGENTS.md). Keep machine-specific paths, credentials, and private issue content out of committed examples; use fixtures written for this project.

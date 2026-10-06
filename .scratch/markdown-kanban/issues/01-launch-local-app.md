# 01: Launch the packaged local web app

Status: ready-for-agent
Blocked by: None

## Outcome

A user can run the locally built `md-kanban` CLI from any directory, optionally supply a ticket folder, and open a working React app served by a local Node process. This is the first runnable slice of the agreed design: CLI to server to browser, including a package that works outside its source checkout.

## Context

Read `AGENTS.md`, `GLOSSARY.md`, `.scratch/markdown-kanban/spec.md`, and `docs/adr/0001-local-web-app.md` before implementing. The repository currently contains design documents only.

Follow `.scratch/markdown-kanban/implementation-workflow.md`: all issues use `feat/md-kanban-v1`, runs proceed without routine clarification questions, and completion includes copying the next issue's prompt to the clipboard.

The agreed stack is React, TypeScript, Vite, and Node, with React Hook Form and Zod where the functionality needs them. This issue does not yet require an editing form or Markdown parser.

## Scope

- Establish the pnpm project, lockfile, strict TypeScript configuration, and the build/check scripts needed for this slice.
- Define the `md-kanban` executable and package the compiled server/CLI and built frontend assets together.
- Accept zero or one positional folder argument. Default to the caller's current working directory; resolve relative arguments from that directory, not the package's installation directory.
- Validate that the selected folder exists, is a directory, and is accessible. Report an actionable error and exit unsuccessfully for invalid input.
- Start a server bound to loopback on an available port, print its URL, and open it in the user's default browser. Provide `--no-open` for headless use and validation. If browser opening fails, keep the working server available and print how to open the URL manually.
- Serve built frontend assets from the package's own location, independently of the selected ticket folder and launch directory.
- Render a minimal React app shell with the project name and selected-folder context. Make it accurate that issue loading is not part of this slice; do not claim the folder has no tickets.
- Shut down cleanly on SIGINT/SIGTERM.
- Update the README and contribution guide with working local development, build, and packed-package verification instructions. Keep registry commands identified as unreleased until publication actually occurs.

## Acceptance criteria

- No argument and `./` resolve to the same folder when launched from the same directory. Relative and absolute explicit folder arguments work.
- A nonexistent path or a file path produces a clear CLI error without starting a server or opening a browser.
- With `--no-open`, the process serves the frontend and provides the selected-folder context to the rendered app without launching a browser.
- A package produced by the project's pack command can be installed into a temporary directory and invoked against a separate temporary ticket folder. Its server and frontend work without access to source-checkout assets or a Vite development server.
- Shutdown releases the server and exits without hanging.
- Type checking and the production build pass. Meaningful automated checks cover argument resolution, invalid input, and the packaged CLI/server boundary; visually verify the app shell if a browser is available.
- Committed files contain no hardcoded developer-machine paths, private hostnames, credentials, or private ticket fixtures.

## Later issues

Issue discovery/parsing, populated boards, search/filtering, dragging, dependencies, editing, file watching, and supporting-document browsing belong to later slices. Do not publish a package or add those features to this issue.

## Comments

# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Spec: `.scratch/<feature-slug>/spec.md`.
- Implementation tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from `01`, with one file per ticket.
- Triage state: a `Status:` line near the top of each issue file,
  using the role strings in `triage-labels.md`.
- Comments and conversation history: append under `## Comments`.

## Publish to the issue tracker

Create the appropriate spec or ticket file using these conventions.
Create its directory if needed.

## Fetch the relevant ticket

Read the referenced file. Resolve a supplied issue number within
the relevant feature's `issues/` directory.

## Wayfinding operations

Used by `/wayfinder`. The map is a file with one child file per ticket.

- Map: `.scratch/<effort>/map.md`, containing Notes,
  Decisions-so-far, and Fog.
- Child ticket: `.scratch/<effort>/issues/<NN>-<slug>.md`,
  numbered from `01`, with the question in the body.
- Type: a `Type:` line records `research`, `prototype`, `grilling`,
  or `task`.
- Status: `open`, `claimed`, or `resolved`.
- Blocking: a `Blocked by: NN, NN` line near the top.
  A ticket is unblocked when every listed ticket is resolved.
- Frontier: scan for open, unblocked, unclaimed tickets;
  choose the lowest number first.
- Claim: set `Status: claimed` and save before starting work.
- Resolve: append the answer under `## Answer`, set `Status: resolved`,
  then append a gist and link to the map's Decisions-so-far.

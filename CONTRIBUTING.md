# Contributing to md-kanban

The project is at the design stage. Start with the [v1 specification](.scratch/markdown-kanban/spec.md), [glossary](GLOSSARY.md), and [architectural decisions](docs/adr/).

There are no application setup or test commands yet. They will be documented when implementation begins.

## Proposing changes

Open an issue at [crankshift/md-kanban](https://github.com/crankshift/md-kanban/issues) to discuss a bug, design change, or feature proposal. Internal specifications and implementation tickets live in `.scratch/` according to [the tracker conventions](docs/agents/issue-tracker.md).

Keep pull requests focused on one change. Describe the resulting behavior and the checks you ran. Changes to ticket parsing or editing should demonstrate that unrelated Markdown is preserved and stale writes are rejected.

If a proposal changes an architectural decision, identify the existing ADR and explain why the trade-off has changed.

## Working with agents

Read [AGENTS.md](AGENTS.md) for repository-specific instructions. Keep project-specific machine paths, credentials, and private ticket content out of committed examples; use fixtures written for this project.

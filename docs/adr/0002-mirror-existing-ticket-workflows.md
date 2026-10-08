# Mirror existing ticket workflows

Status: superseded by [ADR 0008](0008-generic-markdown-workspace.md) for the target product model. These conventions now apply only to the retained optional issue write adapter; they do not organize the generic workspace or define document membership.

The board will use the ticket system's existing status vocabularies, with separate views for implementation issues and wayfinding issues; dragging a card between columns changes the issue's status. We chose compatibility with existing agent skills over introducing a separate Todo / In progress / Done lifecycle, which would require new metadata and rules for agents to maintain. Dependencies will be advisory: wayfinding blockers can be calculated from the `resolved` state, while implementation dependencies are shown without inferring completion from triage readiness.

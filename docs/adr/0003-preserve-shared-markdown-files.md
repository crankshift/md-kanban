# Preserve shared Markdown files when editing

Agents and people can change the same ticket files while the board is running, so structured edits must preserve unrelated content and formatting rather than regenerate whole tickets from a template. Editor saves and immediate status changes must detect stale file contents and reject conflicting writes, preserving a user's draft for recovery. This keeps the board compatible with freeform agent-authored documents at the cost of more careful parsing, targeted updates, and explicit conflict handling.

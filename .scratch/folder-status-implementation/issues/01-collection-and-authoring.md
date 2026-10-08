# Discover visible folders and authorize authored Markdown writes

Status: ready-for-agent

Implement recursive folder inventory/visibility, explicit hidden reads, generic revision-based status/source/comment writes and folder/document creation. Preserve security/atomicity contracts.

## Comments

Implementation underway. Disk/API integration seam: literal Markdown bytes, visibility membership, arbitrary folders, revisions, locks and path/session/origin protections.

## Result

Implemented recursive root/arbitrary-folder inventory and request-local visibility; hidden reads remain separate from membership. Added server-derived status identities/diagnostics and format-preserving YAML/plain/bold status patches, including clearing, blank values, comments, quoting, CRLF and flow mappings. Removed fixed status/type validation and status-derived dependency completion. Generic writable identities reuse revision/UTF-8/locks/atomic replacement; source/comments and exclusive document/folder creation require session/origin and pinned-root checks.

Validation: typecheck/build passed; 42 targeted disk/API/refresh tests passed, including preservation, stale/concurrent writes, symlinks, origin/session/path constraints, arbitrary/empty creation, collisions, root replacement and interrupted locks. Physical filesystem race limitations are documented in CONTRIBUTING. No release work.

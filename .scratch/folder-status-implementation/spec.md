# Implement folder-scoped Markdown workspace

Implement the approved [design](../folder-status-boards/map.md), its six resolved answers, ADRs 0009/0010, and prototype A at `4ce592d`. Execution is separate from resolved design decisions. Preserve production filesystem/session/origin boundaries, URL/query/form state ownership, maps, package boundaries and chunk budget. No release/publication work.

## Test seams

User-authorized portable disk/API/UI integration boundaries: collection and explicit reads; authenticated revision-based writes and creation; production App navigation, dragging and draft recovery. Test externally observable behavior and literal source preservation, not implementation helpers.

# Markdown Ticket Board

A board for understanding work described by issues and specifications.

## Language

**Issue**:
A unit of work or a question to resolve within a feature or effort.
_Avoid_: Task card, ticket (when naming the underlying unit of work)

**Board**:
A view of issues grouped into columns by their status. Implementation issues and wayfinding issues have separate board views because they use different workflows.

**Implementation issue**:
A unit of work needed to implement a feature described by a specification.

**Wayfinding issue**:
A question or unit of investigation within an effort to resolve uncertainty and determine the next work.

**Dependency**:
A relationship identifying another issue whose outcome is needed before the dependent issue can proceed.

**Blocker**:
An unresolved dependency known to prevent an issue from proceeding. A dependency on an implementation issue is not automatically a known blocker because triage status does not establish completion.

**Specification**:
A description of a feature's expected behavior and scope, distinct from its implementation issues.
_Avoid_: Ticket, issue

**Supporting document**:
A document providing context for issues or decisions, such as a specification, wayfinding map, or architectural decision record. It is read alongside issues rather than represented as an issue on the board.

**Triage status**:
A classification indicating whether an issue needs evaluation or information, is ready for an agent or human, or will not be actioned. It does not establish whether implementation is in progress or complete.
_Avoid_: Progress, completion status

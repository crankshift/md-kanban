# Markdown Workspace

A workspace for finding, reading, and understanding Markdown documents and their relationships.

## Language

**Document**:
A Markdown file in the browsable collection, whether it records work, research, guidance, or decisions. It can be understood and found without issue metadata or relationships to other files.

**Folder scope**:
A selected folder and its descendants used to narrow the document collection. It does not require the folder to represent a feature, effort, or workflow.

**Issue**:
A document describing a unit of work or a question to resolve. It can carry optional properties without requiring a particular numbering or workflow convention.
_Avoid_: Task card, ticket (when naming the underlying unit of work)

**Board**:
A view of documents grouped into columns by a chosen property or folder. Columns reflect the documents' actual values without imposing a workflow or completion sequence.

**Property**:
An optional named value recorded with a document, such as status, type, owner, or a dependency reference. Its meaning comes from the document's author rather than a mandatory workspace vocabulary.

**Implementation issue**:
A unit of work needed to implement a feature described by a specification.

**Wayfinding issue**:
A question or unit of investigation within an effort to resolve uncertainty and determine the next work.

**Feature**:
The scope of one specification together with the implementation issues that deliver it.
_Avoid_: Project, epic

**Effort**:
The scope of one wayfinding map together with the wayfinding issues that investigate it.
_Avoid_: Feature (when the scope is wayfinding), project

**Location**:
A folder within the selected folder that holds features and efforts, such as `.scratch` or `docs`. Ticket numbers are only unique within one feature or effort in one location.
_Avoid_: Tracker, root

**Unrecognized issue candidate**:
A Markdown file that looks like an issue but whose status, workflow, or metadata cannot be classified. It is shown for reading with its diagnostics and is never assigned a status or workflow by guessing.
_Avoid_: Broken issue, invalid ticket

**Draft**:
Unsaved edits to an issue held in its open editor until they are saved or explicitly discarded. A draft is never written to the issue's file without an explicit save.
_Avoid_: Pending change

**Dependency**:
A declared relationship identifying another document whose outcome or content is needed by the dependent document. Its target must be explicit; the workspace does not infer its state from a status value.

**Blocker**:
An unresolved dependency known to prevent an issue from proceeding. A dependency on an implementation issue is not automatically a known blocker because triage status does not establish completion.

**Specification**:
A description of a feature's expected behavior and scope, distinct from its implementation issues.
_Avoid_: Ticket, issue

**Supporting document**:
A document providing context or recording knowledge, such as a specification, wayfinding map, architectural decision record, research note, or agent guidance. It may stand alone or accompany issues without becoming a unit of work itself.

**Document map**:
A view of Markdown files and their explicit relationships, including document links and separately identified issue dependencies. A file without relationships still belongs to the browsable collection.

**Document link**:
A reference from one Markdown file to another, written as a Markdown link. It identifies related reading without asserting that either file's work blocks the other.

**Backlink**:
An incoming document link, viewed from the file it references.

**Triage status**:
A classification indicating whether an issue needs evaluation or information, is ready for an agent or human, or will not be actioned. It does not establish whether implementation is in progress or complete.
_Avoid_: Progress, completion status

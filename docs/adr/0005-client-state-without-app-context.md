# Keep client state in the URL, query cache, and editor form

The board's client state has three owners and no app-owned React Context or global store: navigation and view state (workflow, search, filters, the open issue or document, the create dialog) lives in the URL through React Router and nuqs; data read from disk and every write lives in TanStack Query, with live file-change events invalidating its cache; and a draft lives only in its open editor's form. Writes are optimistic and roll back on failure, and a failed save keeps the submitted values on the failed mutation so the user can reopen the editor with their changes. We chose this over a shared store so that reloading or sharing a URL restores the view, there is one source of truth for file contents, and drafts cannot outlive the editor that protects them against stale writes.

## Consequences

- Library providers (Chakra, TanStack Query, nuqs, the router) are the only React Context in the app.
- Closing an editor with unsaved changes asks for confirmation; drafts are not kept after the editor closes or across reloads.
- The server serves the client for non-API paths so deep links resolve.

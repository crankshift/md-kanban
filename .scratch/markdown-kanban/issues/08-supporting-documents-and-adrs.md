# 08: Browse supporting documents and ADRs

Status: ready-for-agent
Blocked by: 07

## Outcome

A user can read specifications, wayfinding maps, and architectural decisions beside the board and follow local document links from issues.

## Scope

- Add read-only supporting-document browsing and rendered Markdown in the side panel.
- For a repository-root launch, discover `docs/adr` alongside the specifications and maps associated with recognized issue containers.
- Resolve relative local Markdown links from their source document and open available targets within the selected root. Show clear unavailable results for missing or out-of-scope targets.
- A direct issue-folder launch remains restricted to that folder and does not automatically expand access to parent repositories.
- Reuse safe Markdown rendering and keep supporting-document metadata separate from issue parsing.

## Acceptance criteria

- Repository-root browsing exposes specs, maps, and ADRs; selecting one renders its Markdown without editing controls.
- An ADR containing `Status: proposed` is a supporting document, never a card or Needs attention entry.
- Links from an issue or specification open the correct in-root target and handle fragments where supported by the renderer.
- Missing targets and links escaping the selected root, including via symlinks, are reported as unavailable rather than read anyway.
- Reading a supporting document writes no files, and its content stays current when revisited after an external edit.
- Relevant link/discovery/UI integration checks, type checking, and production build pass.

## Comments

### Implementation result — 2026-10-06

- Added read-only supporting-document browsing. `src/server/documents.ts` (schemas in `src/server/document-types.ts`, shared with the client) adds `GET /api/documents`, `GET /api/document?path=` and `GET /api/document-link?from=&href=`. The list contains `spec.md`/`specification.md`/`map.md` beside each discovered issue container and, when `classifyRoot` (extracted from `discoverIssues`) reports a repository root, the Markdown files in `docs/adr`. Document metadata is separate from issue parsing: only the first heading is read as a title, so an ADR with `Status: proposed` is a document, never a card or Needs attention entry (discovery still excludes `adr`). The routes are GET/HEAD only behind the existing Host/Origin/Fetch Metadata checks; they write nothing, so this ticket introduces no mutation and no new stale-write surface.
- Link resolution is lexical from the source document, then verified on disk: percent-decoding, backslashes, schemes, `//`, absolute paths, and `..` leaving the root are unavailable; targets must exist and be regular Markdown files; every path component is `lstat`ed and any symbolic link (even one that stays inside the root, consistent with discovery and the writer) is refused; `.git`, `node_modules`, and files over 2 MiB are refused; reads use `O_NOFOLLOW` plus an inode check. A direct issue-folder launch exposes only documents inside that folder (its parent's spec and ADRs are unavailable); a feature folder exposes its own spec/map.
- Client: a **Supporting documents** list (specifications, maps, ADRs) and a read-only `DocumentPanel` with no editing controls. Relative links in issues and documents open in the panel; a link to a discovered issue opens that issue; **Back to issue / previous document** returns. Unavailable links show an alert naming the link and reason, leaving the current panel open. `SafeMarkdown` now assigns scoped heading ids (GitHub-style slugs, duplicate numbering), scrolls same-document and cross-document fragments (a missing section is reported), opens external links in a new tab with `rel="noopener noreferrer"`, and renders local links inert in body/comment/creation previews so a draft cannot be navigated away. Documents are re-read on open, on window focus, and via **Reload document**; the list reloads on board change and focus. Updated README and CONTRIBUTING (new Supporting-document boundary section). No new dependency.
- Verification: final `pnpm check` passed strict type checking, the production build, and all 93 tests. New `tests/documents-api.test.mjs` (real files/HTTP: listing, ADR-not-a-card, content freshness after external edit, no file/mtime changes, fragments, missing/out-of-scope/malformed/absolute/scheme links, symlink files and folders including escapes, symlinked root, direct issue-folder and feature-folder launches, read-only routes and origin checks, size cap) and `tests/documents-ui.test.mjs` (real React/jsdom board against a real server: list, read-only panel, link following, Back chain, fragment scrolling, unavailable reports, issue-from-spec, revisit/reload/focus after external edits, removed document, inert previews). The installed-tarball test also checks a packaged spec and an escaping link. Portable temporary fixtures only; loopback/package tests ran outside the restricted sandbox as in earlier tickets. No separate visual-browser check was performed.
- Code review: Standards found no documented breaches or ADR conflicts; judgement-call duplication of the safe-read/symlink walk with `discovery.ts`/`writes.ts`/`creation.ts` was left unconsolidated to keep this ticket focused. Spec found no blocking defect; I fixed a double percent-decoding of fragments (the server now returns them encoded), removed an unused document `revision`, and corrected the README note about feature folders and ADRs.
- Limitations: specs/maps are listed only for containers that contain a discovered issue and only under the names above. Any in-root Markdown file reachable by a link (for example a README) opens, but it is not listed. A document does not refresh on its own when edited externally (the watcher fingerprint still covers issues only); revisit, focus, or **Reload document** read the file. Case-mismatched or `NODE_MODULES`-style links get a generic unavailable reason. Links to issue targets ignore fragments. `docs/adr/README.md` is listed as an ADR and nested ADR folders are not. A folder with `docs`, `.scratch` or `.git` inside is treated as a repository root even if it is a feature folder. `readDocument` re-runs discovery to find its kind/title; fine for local folders, not optimized. The ~520 kB bundle warning remains.
- Handoff for ticket 09: all v1 features are implemented; verify the complete spec end to end (including manual browser use, which has not been done visually in any ticket), `pnpm check`, the packed package, docs accuracy, and the release-candidate state. Triage remains `ready-for-agent`; only the workflow checkbox records completion.

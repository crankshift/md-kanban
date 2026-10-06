# 06: Create issues in an existing feature or effort

Status: ready-for-agent
Blocked by: 05

## Outcome

A user can create an implementation or wayfinding issue in an existing supported container and immediately see it on the appropriate board.

## Scope

- Let the user choose an existing feature/effort and its recognized workflow, then enter the title, initial status, Markdown body, and optional same-scope dependencies.
- Follow the selected container's numbering, filename, title, and metadata conventions. Use the repository's documented numbered Markdown format when no more specific existing style is available.
- Allocate a free number and create the file without overwriting existing work, including when concurrent creation occurs.
- Reuse form validation and editor components where appropriate and show the created issue's details on success.
- Keep creation limited to issues in existing containers; new specifications, efforts, ADRs, custom labels, deletion, and cross-feature dependencies remain outside this issue.

## Acceptance criteria

- Creation works in `.scratch/.../issues`, supported `docs` containers, and a directly selected issue folder with a recognized workflow.
- The created file is compatible with existing discovery and the matching agent ticket conventions.
- Existing issue files cannot be overwritten through number collisions, slugs, or manipulated paths.
- Failed creation keeps the entered content available and does not display an issue as successfully created.
- The board and search include successfully created issues without restarting the app.
- Relevant file/API/form integration checks, type checking, and production build pass.

## Comments

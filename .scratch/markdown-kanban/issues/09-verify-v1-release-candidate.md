# 09: Verify the complete v1 and prepare the local release candidate

Status: ready-for-agent
Blocked by: 12, 13, 14

## Outcome

The implemented v1 meets the agreed specification as a locally installable package, with accurate user instructions and documented verification.

## Scope

- Audit the implementation against every acceptance criterion in the specification and resolve gaps within the agreed scope.
- Verify the packed package from outside the checkout against portable fixtures covering `.scratch`, `docs/tickets`, mixed locations, both workflows, supporting documents, and file conflicts.
- Exercise the main user journey: launch, find/read a ticket, follow a dependency, move status by dragging and by keyboard, switch between board and list, jump with the command palette, collapse the sidebar, edit/comment, create an issue, observe an agent edit, recover a conflicting draft, fix an unrecognized issue candidate, read an ADR, and reload a deep link.
- Check that packaged files contain the required runtime assets and intended public content, with no private paths, credentials, private ticket fixtures, or dependency/build clutter.
- Update the README and contribution guide to describe the implemented behavior, local use, supported runtime, and actual verification commands. Distinguish local package readiness from registry publication.
- Rename the changelog's `Unreleased` section to `0.1.0` with the release-candidate date.
- Run the complete required checks once after final fixes; repeat only as justified by new changes or failures.

## Acceptance criteria

- Type checking, production build, relevant automated checks, and packed-package end-to-end verification pass.
- The documented commands work from a fresh temporary installation without source-checkout assets.
- The shared-file preservation and stale-write behavior are exercised through actual user flows rather than only isolated helper tests.
- The user-facing README matches implemented functionality and does not claim an npm release that has not occurred.
- The specification's required behavior is fulfilled; any remaining limitations are documented accurately and do not conceal unmet acceptance criteria.
- All completed issues and this workflow have accurate completion records on the single feature branch.
- No deployment, npm publication, remote push, or merge is performed as part of this issue.

## Comments

### Implementation result — 2026-10-06

- Audit: every acceptance criterion in the specification was exercised against the packed package or is covered by the existing suites. One gap was fixed: long dependency badges (for example "1 dependency reference needs attention") overflowed narrow cards into the next column. They now wrap inside the card (`src/client/Dependencies.tsx`); checked in light and dark mode.
- Packed package: `pnpm pack` produces `mdkanban-0.1.0.tgz` with 35 files: `package.json`, `README.md`, `LICENSE`, `dist/server/*.js`, and `dist/client` (`index.html`, one script, one stylesheet, bundled fonts). It has no source maps, tests, `.scratch` tickets, machine-specific paths, or credentials. pnpm drops the `prepack` script from the packed manifest. The bin is executable and starts with `#!/usr/bin/env node`.
- Outside the checkout: `npx --package <tarball> mdkanban` and `pnpm dlx --package <tarball> mdkanban` ran from an empty temporary folder. An invalid folder fails before startup with exit code 1. Against a portable repository-root fixture (`.scratch` implementation and wayfinding features, `docs/<feature>/tickets` with CRLF line endings, a same-named feature in two locations, a Needs attention file, a spec, a map, an ADR with `Status: proposed`, `docs/guide.md`, and `node_modules`), launching with no folder, with `./`, and with `repo` from the parent selected the same folder. Discovery returned 8 issues with distinct `01`s. The ADR, guide, spec, map, and vendored issue stayed off the board; the ADR, spec, and map were listed as documents. Tracker (`.scratch`), `docs`, feature, and direct issue-folder launches scoped issues and documents as specified. The issue-folder launch exposed no documents.
- Main journey in headless Chromium (Playwright, scripts and fixtures outside the repository) against the packed install: search and open an issue, follow a dependency, see the missing-reference diagnostic, browser Back, Escape; keyboard drag (`**Status:**` style kept) and mouse drag (CRLF bytes kept); Board/List switch; command palette to a wayfinding issue with blocker info; sidebar collapse by button and `[`; title edit and comment append (checkbox, unknown section, and metadata style kept); external agent edit appearing without reload; conflicting draft kept, stale save rejected (409) without overwriting the external body, then **Reapply mine on latest** saved; **New issue** with a dependency and preview, creating `04-package-check.md` in the existing bold-key style; Needs attention fix changing only the status line and moving the issue to the board; spec link to the ADR rendered read-only and missing link reported; deep links for an issue and an ADR restored after reload. No native `<select>` and no page errors, apart from the browser's automatic favicon 404.
- Documentation: README now says 0.1.0 is complete as a local package but not on npm, lists the runtime split (Node 22.12+ for the CLI, Node 22.22+ and pnpm 11.21.0 for checkout builds), and describes the board in the present tense. The registry section stays marked unreleased; ticket 15 removes that wording after publishing. CONTRIBUTING describes the finished v1, how to run a tarball with `npx`/`pnpm dlx`, and the release-candidate checks. CHANGELOG `Unreleased` is now `0.1.0` dated 2026-10-06, with an empty `Unreleased` above it and comparison links for the `v0.1.0` tag. A stale note saying Needs attention was read-only until its repair ticket was removed.
- Checks: `pnpm check` passed type checking, the production build, and all 122 tests before and after the changes. The CONTRIBUTING packed-package recipe ran as written. A fresh `git clone` ran `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm start --no-open ./`.
- Limitations: the existing nonblocking Vite bundle-size warning remains (ADR 0004's accepted Chakra tradeoff). Mouse dragging under automation needs paced pointer moves; the keyboard sensor moves by pixels, as noted in ticket 12. No physical touch device or screen-reader session was tested. The filesystem-race, abandoned-lock, and tab-memory draft limitations from tickets 04–07 and 10 still apply. Nothing was published, pushed, or merged.
- Next: ticket 15 (publish to npm) needs a human with npm two-factor authentication. `mdkanban` was free on the registry when checked on 2026-10-06.

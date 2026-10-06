# 09: Verify the complete v1 and prepare the local release candidate

Status: ready-for-agent
Blocked by: 08

## Outcome

The implemented v1 meets the agreed specification as a locally installable package, with accurate user instructions and documented verification.

## Scope

- Audit the implementation against every acceptance criterion in the specification and resolve gaps within the agreed scope.
- Verify the packed package from outside the checkout against portable fixtures covering `.scratch`, `docs/tickets`, mixed locations, both workflows, supporting documents, and file conflicts.
- Exercise the main user journey: launch, find/read a ticket, follow a dependency, move status, edit/comment, create an issue, observe an agent edit, recover a conflicting draft, and read an ADR.
- Check that packaged files contain the required runtime assets and intended public content, with no private paths, credentials, private ticket fixtures, or dependency/build clutter.
- Update the README and contribution guide to describe the implemented behavior, local use, supported runtime, and actual verification commands. Distinguish local package readiness from registry publication.
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

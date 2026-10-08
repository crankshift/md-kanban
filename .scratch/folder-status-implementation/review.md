# Final two-axis review

Fixed point: production `main` at `5c80e960d787fdd3e3a5bbb08f95cfea4ab03e26`.
Comparison: `git diff main...HEAD`, followed by review of corrective working-tree changes.
Initial implementation commits: `9ab5115`, `39e6805`, `fda8896`.

## Standards

One documented-standard violation: Discard mine restored a recovered mutation's old baseline/source instead of latest disk data and did not reset a status draft. This contradicted ADR 0003's stale recovery and the contributor draft contract.

Resolved: Discard mine adopts latest disk baseline, resets source/comment/status, clears recovered failure and resets mutation state. The production UI regression reopens and discards a lost-response comment draft. Creation recovery also retains its original target folder when mounted under a different workspace scope. The Standards reviewer verified these working-tree corrections. No additional actionable heuristic smells reported.

## Spec

Four findings:

1. Status insertion could target a fenced/body heading instead of a leading document title.
2. Clearing a flow YAML property with inline comments could leave its separator and publish invalid YAML.
3. YAML key matching omitted the whitespace normalization used by the metadata reader.
4. Descendant card cursors could override the body's grabbing cursor.

Resolved: leading-title-only insertion with document-start fallback; YAML CST separator offsets preserving comments; consistent trimmed/case-folded key comparisons; descendant-inclusive drag cursor CSS and cleanup. A postcondition rejects any patch that fails to produce the intended unambiguous status. Literal disk/API regressions cover fenced examples, spaced keys, flow inline comments and trailing commas. The Spec reviewer directly verified every correction and found no immediate regression. The reviewer sandbox could not bind loopback; the primary agent ran disk/API tests with the required local-port permission.

Initial findings: Standards 1, Spec 4. Verified outstanding findings: Standards 0, Spec 0.

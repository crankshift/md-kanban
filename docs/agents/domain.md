# Domain Docs

This repo uses a single-context domain documentation layout.

## Before exploring the codebase

- Read `GLOSSARY.md` at the repo root if it exists.
- Read ADRs in `docs/adr/` relevant to the area being explored.

If these files are absent, proceed silently. Create domain docs
lazily through `/domain-modeling` when terms or decisions are resolved.

## File structure

- `GLOSSARY.md`: shared domain vocabulary.
- `docs/adr/NNNN-<decision-slug>.md`: architectural decisions.

## Use the glossary's vocabulary

Use defined domain terms in issue titles, refactor proposals,
hypotheses, and test names.

When a needed concept is absent, reconsider whether it belongs to
the domain. Record genuine vocabulary gaps for `/domain-modeling`.

## Flag ADR conflicts

Explicitly identify any existing ADR that a proposal contradicts,
and explain why reopening that decision is warranted.

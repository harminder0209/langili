# Domain Docs

This repository uses a single-context layout: `CONTEXT.md` at the repo root
and architecture decision records (ADRs) under `docs/adr/`.

## Before exploring, read these

- Read root `CONTEXT.md` for domain terms and context.
- Read ADRs in `docs/adr/` relevant to the area you are about to work in.

If these files do not exist, proceed silently. Do not flag their absence or
suggest creating them upfront. The `/domain-modeling` skill, reached via
`/grill-with-docs` and `/improve-codebase-architecture`, creates them lazily
when terms or decisions get resolved.

## File structure

```text
/
├── CONTEXT.md
├── docs/adr/
│   └── 0001-<decision-slug>.md
└── src/
```

## Use the glossary's vocabulary

When naming a domain concept in an issue, proposal, hypothesis, or test, use
the term defined in `CONTEXT.md`. Avoid synonyms the glossary explicitly rejects.
If a concept is missing, reconsider whether it belongs to the project or note
the gap for `/domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain why
the decision should be revisited rather than silently overriding it.

# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those
roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the
corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Specs, tickets and the AFK queue

`ready-for-agent` is a triage label only. It never starts an agent. Agent work
starts only when an approver dispatches an AFK run, and that run builds
**ready tickets**: open issues with a `## Parent` section, `ready-for-agent`
and no open blockers (see `CONTEXT.md` and §11 of `docs/spec/langili-skeleton.md`).

These rules override the matching steps in the `to-spec` and `to-tickets` skills:

- **`/to-spec`**: publish the spec issue with **no** triage label. Never apply
  `ready-for-agent` to a spec.
- **`/to-tickets`**: apply `ready-for-agent` to tickets that touch product paths
  only, and `ready-for-human` to anything touching infrastructure paths. Keep
  each ticket's `## Parent` section, and record blockers as native issue
  dependencies.
- **After `/to-tickets` publishes**, close the spec issue with a comment listing
  its tickets. The tickets carry the work from then on.
- **Maps** (`wayfinder:map`) never carry `ready-for-agent`.

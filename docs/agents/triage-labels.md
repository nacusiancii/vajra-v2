# Triage Labels

The skills speak in terms of canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker (GitHub Issues — see `issue-tracker.md`).

## State roles

| Role (skill)      | Label in our tracker | Meaning                                           |
| ----------------- | -------------------- | ------------------------------------------------- |
| `triage-done`     | `triage-done`        | Maintainer has finished evaluating (parked)       |
| `needs-info`      | `needs-info`         | Waiting on reporter for more information          |
| `needs-research`  | `needs-research`     | Needs investigation before an implementable brief |
| `ready-for-agent` | `ready-for-agent`    | Fully specified, ready for an AFK agent           |
| `ready-for-human` | `ready-for-human`    | Requires human implementation                     |
| `wontfix`         | `wontfix`            | Will not be actioned                              |

**Unlabeled issues need evaluation** — do not require a state label when creating tickets. After evaluation, apply exactly one state: `triage-done`, `needs-info`, `needs-research`, `ready-for-agent`, `ready-for-human`, or `wontfix`. (Upstream skills may still say `needs-triage`; map that to `triage-done` here.)

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table. "Apply a label" means `gh issue edit <number> --add-label "<label>"`, removing the previous state label in the same command so an issue carries exactly one state.

## Priority roles

Priority is orthogonal to state. A triaged issue may carry at most one priority label.

| Role (skill)    | Label in our tracker | Meaning                                      |
| --------------- | -------------------- | -------------------------------------------- |
| `prio-highest`  | `prio-highest`       | Blocks first demo / ship-critical            |
| `prio-high`     | `prio-high`          | High priority for the next milestone         |
| `prio-medium`   | `prio-medium`        | Medium priority                              |
| `prio-low`      | `prio-low`           | Low priority / parkable until higher work    |

When changing priority, remove the previous `prio-*` label in the same edit so only one remains.

## Additional labels

- The category roles map to GitHub's default `bug` and `enhancement` labels.
- `epic` — a big feature tracked as a parent issue with child issues (see the epic workflow in the triage skill). An epic carries `epic` plus a category label (and optionally a priority), never a `ready-for-*` / other state role.

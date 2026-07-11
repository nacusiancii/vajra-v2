# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker (GitHub Issues — see `issue-tracker.md`).

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table. "Apply a label" means `gh issue edit <number> --add-label "<label>"`, removing the previous state label in the same command so an issue carries exactly one state.

## Additional labels

- The category roles map to GitHub's default `bug` and `enhancement` labels.
- `epic` — a big feature tracked as a parent issue with child issues (see the epic workflow in the triage skill). An epic carries `epic` plus a category label, never a `ready-for-*` state.

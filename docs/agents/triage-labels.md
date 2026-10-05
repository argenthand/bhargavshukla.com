# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

All five exist on GitHub. When they were set up, `needs-info` was renamed from `question` and `needs-triage` from `help wanted`, the two `ready-for-*` labels were added, and the unused `duplicate`, `invalid` and `good first issue` were deleted.

The repo's other labels aren't triage states: they say what an issue is about. Leave them as they are when triaging, and add the fitting ones to new issues:

- **Area:** `frontend`, `cms`, `infra`, `ops`, `design`, `documentation`
- **Kind:** `bug`, `enhancement`, `accessibility`
- **Roadmap phase:** `phase:0` to `phase:6` (see [roadmap.md](../roadmap.md))

If the labels change on GitHub, edit the middle column to match.

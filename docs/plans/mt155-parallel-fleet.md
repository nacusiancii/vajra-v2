# mt155 parallel fleet — EOD / Rollover

**Megathread:** [#155](https://github.com/nacusiancii/vajra-v2/issues/155)  
**Safe tag:** `mt155-pre-fleet` (on main before this fleet)  
**Worst case:** scrap worktrees/PRs, reset knowledge to tag, retry tomorrow.

## Process

1. Tag `mt155-pre-fleet` on main
2. This plan + tasklist (preflight PR)
3. `bash scripts/grokflows/implement.sh` with `max_parallel: 5`
4. Per PR: agentic review LGTM → UI review screenshots → merge
5. Screenshots land in **main** worktree: `.pr-screenshots/pr-<id>/` (local-only; gitignored)

Parallel is intentional: expect **merge conflicts** across Rollover / `eod-xlsx` / settings. Resolve at merge time.

## Non-goals (this fleet)

- Per-line loading charges in DB (cut — report uses synthetic `loading` line)
- Offline auth / TOTP
- Multi-day retention

## Tasks (parallel)

Machine-readable copy for grokflows: `scripts/grokflows/tasklist-mt155.json` (local / gitignored dir may also hold a copy).

| Slug                   | Summary                                                |
| ---------------------- | ------------------------------------------------------ |
| `eod-silent-export`    | Silent export to `~/Documents/VajraExports` + toast    |
| `eod-export-gate`      | Approve only after export since last ledger mutation   |
| `eod-next-biz-day`     | Choose next Business Day on Rollover (preselect rules) |
| `eod-edit-empty-day`   | Edit open Business Day date when no finished txns      |
| `eod-line-items-sheet` | Line Items sheet + line kind column                    |
| `eod-money-sheet`      | Non-stock money sheet (RE/PA/IN/EX)                    |
| `eod-home-export`      | Home Masters & Records Export quick action             |

## Merge note

After squash-merge, rebase remaining open `mt155/*` branches onto main before merging the next conflicting PR when conflicts are painful — or merge and fix conflicts in the PR branch.

# Grokflows — megathread #123 fleet

Headless launchers for finishing [Next Alpha Release Megathread #123](https://github.com/nacusiancii/vajra-v2/issues/123).  
**No `~/.zshrc` aliases required** — everything is under `scripts/grokflows/`.

There is **no chief role**. Orchestration is:

| Session type                                  | What happens                                          |
| --------------------------------------------- | ----------------------------------------------------- |
| **Preflight** (this PR)                       | Domain + gate + scripts on `main`                     |
| **Workflow** (one session)                    | Launch Phase 1 fleet (≤5 parallel implementers)       |
| **Per change** (one interactive session each) | Phase 2: human audit of the draft PR + spawn `fix.sh` |
| **Party** (one session)                       | Merge remainder if needed, E2E, close #123            |

## Prerequisites

- `grok` on `PATH` (`~/.grok/bin`)
- `gh` authenticated
- `main` green after preflight merge
- Free RAM: prefer ≤3 concurrent implementers on 14 GiB machines; hard cap 5

## Shared quality gate

```bash
pnpm agent:check:autofix   # flock → lint:fix + format + typecheck
```

Implementers must call **only** this script for local feedback (not bare `pnpm fix`).

## Brief contract

Ideal implement brief is the **single megathread checkbox line** plus the fixed footer in `brief-footer.md` (auto-assembled by `implement.sh`).

## Phase 1 — fleet implement

From the **main** repo clone (after preflight is on `main`):

```bash
# example wave — run in background shells / Workflow session
sh scripts/grokflows/implement.sh recent-non-void \
  "Only Non Voided Transactions in Recent Transactions." &

sh scripts/grokflows/implement.sh customer-readonly \
  "Display read only place and mobile no when customer is chosen from customer master in both sales and purchases." &

sh scripts/grokflows/implement.sh remarks \
  "Ensure remarks field is present in all transactions. Include Remarks in invoice." &

sh scripts/grokflows/implement.sh invoice-print \
  "Two printout copies for cash sale invoice by default (opt-out during sale); Sale Invoice includes Place and Phone No." &

# wait; then more as slots free — no ordered wait for merge
sh scripts/grokflows/implement.sh walk-in-optional \
  "Walk in details name and place should be optional. Store as Walk in in back end if not present." &

sh scripts/grokflows/implement.sh serials \
  "Serial Nos for Edited Sales (20.1, 20.2); separate sequences for Cash vs Credit Sale/Purchase; voucher shares credit sale serial. Internal ID is the only source of truth." &

sh scripts/grokflows/implement.sh sale-discount \
  "Add Discount on sales — both cash and credit. Display name Discount; simple amount reducing total (not Settlement Discount / face)." &
```

Each job:

1. Creates `../vajra-mt123-<slug>` on `mt123/<slug>` from `origin/main`
2. `pnpm install` once
3. Writes `.grok-brief.md`
4. Runs `grok` with **tight allows** (no blanket `git *` / `gh *`)
5. Logs to `.grok-run.jsonl`

Dashboard:

```bash
sh scripts/grokflows/status.sh
```

**Merge conflicts:** do not serialise implementation. Rebase/fix conflicts as they appear when merging.

**Screenshots:** UI tasks should push PNGs under `.pr-screenshots/<slug>/` and link them in the draft PR body.

## Phase 2 — interactive audit (separate Grok session per PR)

Most manual step. In a **new interactive session** focused on one draft PR:

1. `gh pr view N` / `gh pr diff N` / screenshots
2. Interactive **change audit**: intentional vs accidental; domain fit; task-line scope
3. Write accepted blockers only to e.g. `/tmp/mt123-<slug>-feedback.md`
4. Spawn fix agent:

```bash
sh scripts/grokflows/fix.sh <slug> /tmp/mt123-<slug>-feedback.md
```

5. Re-check CI (`gh pr checks N --watch`); repeat fix if needed
6. Mark ready and merge when satisfied (or leave for Party session)

Optional mechanical second opinion:

```bash
sh scripts/grokflows/review.sh <slug> <pr> 1
sh scripts/grokflows/review.sh <slug> <pr> 2
```

## Phase 3 — Party

1. All `mt123/*` PRs merged; worktrees removed
2. `pnpm agent:check:autofix` on `main`
3. E2E / `pnpm verify:headless` or CI + cashier walkthrough for #123 behaviours
4. Close #123 with PR links
5. Party

## Allow-list policy

Implement/fix may use only:

| Tool / Bash pattern                                                   | Why                               |
| --------------------------------------------------------------------- | --------------------------------- |
| Edit, Write, Read, Grep                                               | Code and brief                    |
| `pnpm agent:check:autofix`                                            | Sole local quality gate           |
| `git status/diff/add/commit/push/log/rev-parse/branch --show-current` | Land the PR                       |
| `gh pr create/view/edit/comment`                                      | Draft PR + body/screenshots notes |
| `ls/cat/head/tail/rg/mkdir/cp/mv/file/which/jq`                       | Navigation                        |

**Not** allowed: blanket `git *` / `gh *`, `pnpm verify*`, `pnpm test:smoke*`, `pnpm install`, worktree surgery, merge, `--always-approve`.

## Suggested slugs ↔ #123 lines

| Slug                | Task line (abbrev)                                       |
| ------------------- | -------------------------------------------------------- |
| `recent-non-void`   | Only non-voided in Recent Transactions                   |
| `customer-readonly` | Read-only place + mobile from master                     |
| `walk-in-optional`  | Walk-in name/place optional → `"Walk in"`                |
| `remarks`           | Remarks on all txns + invoice                            |
| `invoice-print`     | Two copies default (opt-out) + place/phone on invoice    |
| `serials`           | Edit revisions + cash/credit sequences; internal ID only |
| `sale-discount`     | Sale **Discount** reduces total (cash + credit)          |

## Cleanup

```bash
git worktree remove ../vajra-mt123-<slug>
git branch -D mt123/<slug>   # after merge
```

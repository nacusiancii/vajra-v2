---
name: grok-it
description: Delegate any task to a headless grok CLI in an isolated worktree. The chief only briefs, launches, and judges — never implements. Use when the user says "grok it", "send grok", or wants the intern doing the work.
---

# /grok-it — chief does nothing 🪿

**Mandate:** harness grok. You brief → launch → judge. You do **not** write the code (even if you _are_ Grok — fresh headless goose only).

## Easy path (copy this)

Pick a short `<task>` slug (e.g. `loose-fix`, `issue-75`).

### 1. Stage

```bash
git worktree add ../vajra-grok-<task> -b grok/<task> main
(cd ../vajra-grok-<task> && pnpm install)
```

### 2. Brief

Write `../vajra-grok-<task>/.grok-brief.md` by filling this template:

```markdown
# Task
<one sentence>

# Sources
- Issue #N (body + comments; newest wins): <paste decisions>
- Read AGENTS.md + CONTEXT.md
- Landmines: money = integer paise; mass = grams
- Deps already installed — do NOT run pnpm install

# Do
<what done looks like; behaviours not file paths>

# Do not
- Drive-by refactors
- <anything else out of scope>

# Stop
run `pnpm fix` (lint:fix + format only), commit with a conventional message,
push, open a **draft** PR (`gh pr create --draft`) with body note
"implementation by grok CLI — pending verification", then STOP.
Do not run `pnpm verify` / `pnpm test:smoke` locally — CI runs on every push,
so pushing is the check. No mark-ready, no merge, no new tasks.
```

**Research / read-only only?** Replace `# Stop` with: `Return findings as markdown. No commit, no push, no PR. STOP.`

**Fork-heavy feature?** Run `/to-prd` first; paste the PRD into Sources.

### 3. Launch (default allows — just use them)

```bash
grok-headless ../vajra-grok-<task>
# optional 2nd arg if the brief isn't <worktree>/.grok-brief.md:
# grok-headless ../vajra-grok-<task> /path/to/brief.md
```

The allow-list and `--check` / `--max-turns 200` (plus `--output-format streaming-json`) are baked into the `grok-headless` shell alias — extend it by editing your shell config, not by passing extra flags. What it grants: `Edit`, `Write`, `Read`, `Grep`, `Bash(pnpm *)`, `Bash(git *)`, `Bash(gh *)`, `Bash(grep *)`, `Bash(rg *)`, `Bash(find *)`, `Bash(diff *)`, `Bash(ls *)`, `Bash(cat *)`, `Bash(head *)`, `Bash(tail *)`, `Bash(wc *)`, `Bash(sort *)`, `Bash(uniq *)`, `Bash(tree *)`, `Bash(jq *)`, `Bash(file *)`, `Bash(which *)`.

Run in the background; watch the log. **Never** `--always-approve` / `--yolo`.

### 4. Judge (three checks, then stop thinking)

| # | Check | How |
|---|--------|-----|
| 1 | Green | `gh pr checks <pr> --watch` (or `gh run watch` after first push, before the draft PR) — trust CI, not the transcript. No local re-verify. |
| 2 | Diff matches brief | `git -C ../vajra-grok-<task> diff main...HEAD` |
| 3 | Stayed home | transcript never left the worktree |

- **Pass** → `gh pr ready` + comment `verified by <chief>`
- **Fail** → close draft; failure text becomes the next brief

### 5. Debrief → cleanup

1. Run **`/what-did-i-just-grok`** (fill the form — 2 minutes).
2. Then: `git worktree remove ../vajra-grok-<task>` and delete branch `grok/<task>`.

---

## Optional plays (only if needed)

Same worktree, **new** headless grok each time. Never trust the previous goose.

| Play | Brief them to… |
|------|----------------|
| **Test** | Break the last diff (money, stock, modes, empty cart). Report bugs; delete wrecking-ball tests unless high-value. |
| **Cleanup** | Sweep debris (dead code, debug logs). Keep behaviour; `pnpm fix` clean and CI green on push. |
| **Simplify** | Reuse/simpler only — no bug hunt. Skip if not clearly simpler. |
| **Research** | Findings markdown only; use the read-only stop clause. |

Bugs → new implementation brief. You still do not fix them.

Hard problem? Add `--best-of-n N`. Intern hiring interns? Add `--no-subagents`.

Stuck on allows? Default list is fine for almost everything. Drop `Edit`/`Write`/`gh` for pure research. Add a `Bash(…)` only when the log shows a denied useful command — then note it in the debrief.

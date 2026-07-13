---
name: grok-it
description: Delegate any task to a headless grok CLI in an isolated worktree. The chief only briefs, launches, and judges — never implements. Use when the user says "grok it", "send grok", or wants the intern doing the work.
---

# /grok-it — chief does nothing 🪿

**Mandate:** harness grok. You brief → launch → judge. You do **not** write the code (even if you *are* Grok — fresh headless goose only).

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
run `pnpm fix:headless` until green, commit with a conventional message, push,
open a **draft** PR (`gh pr create --draft`) with body note
"implementation by grok CLI — pending verification", then STOP.
No mark-ready, no merge, no new tasks.
```

**Research / read-only only?** Replace `# Stop` with: `Return findings as markdown. No commit, no push, no PR. STOP.`

**Fork-heavy feature?** Run `/to-prd` first; paste the PRD into Sources.

### 3. Launch (default allows — just use them)

```bash
grok-headless ../vajra-grok-<task> > ../vajra-grok-<task>/.grok-run.jsonl
```

`grok-headless` is a zsh function (`~/.zshrc`) wrapping the full `grok` invocation — prompt file, cwd, `--check --max-turns 200`, the default `--allow` list below, and `--output-format streaming-json` so output flushes line-by-line instead of buffering silently until exit:

```bash
grok --prompt-file "$brief" --cwd="$worktree" --check --max-turns 200 \
  --output-format streaming-json \
  --allow "Edit" --allow "Write" --allow "Read" --allow "Grep" \
  --allow "Bash(pnpm *)" --allow "Bash(git *)" \
  --allow "Bash(gh pr create *)" \
  --allow "Bash(grep *)" --allow "Bash(rg *)" --allow "Bash(find *)" \
  --allow "Bash(diff *)" --allow "Bash(ls *)" --allow "Bash(cat *)" \
  --allow "Bash(head *)" --allow "Bash(tail *)" --allow "Bash(wc *)" \
  --allow "Bash(sort *)" --allow "Bash(uniq *)" --allow "Bash(tree *)" \
  --allow "Bash(jq *)" --allow "Bash(file *)" --allow "Bash(which *)"
```

Hand the `grok-headless ...` line to your backgrounded-shell tool **as one command, verbatim** — do **not** wrap it in your own `nohup ... &`. Backgrounding it yourself makes the wrapper shell (not grok) the thing that gets tracked, so "command finished" fires the instant the wrapper detaches — before grok has done anything. Let the harness's own backgrounding track the real `grok` process, so its completion notification actually means grok is done.

Watch progress and detect real completion from the log:

```bash
jq -r 'select(.type=="text") | .data' ../vajra-grok-<task>/.grok-run.jsonl   # readable transcript so far
tail -5 ../vajra-grok-<task>/.grok-run.jsonl | jq .                          # look for "type":"end"
```

A `"type":"end"` event (carries `stopReason`, `sessionId`, `usage`) is the real completion signal — its absence means grok is still running even if the launch command already reported done. **Never** `--always-approve` / `--yolo` (already excluded from `grok-headless`).

### 4. Judge (three checks, then stop thinking)

| # | Check | How |
|---|--------|-----|
| 1 | Green | `gh pr checks <pr> --watch` — trust CI, not the transcript. No local re-verify. |
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
| **Cleanup** | Sweep debris (dead code, debug logs). Keep behaviour; `pnpm fix:headless` green. |
| **Simplify** | Reuse/simpler only — no bug hunt. Skip if not clearly simpler. |
| **Research** | Findings markdown only; use the read-only stop clause. |

Bugs → new implementation brief. You still do not fix them.

Hard problem? Add `--best-of-n N`. Intern hiring interns? Add `--no-subagents`.

Stuck on allows? Default list is fine for almost everything. Drop `Edit`/`Write`/`gh` for pure research. Add a `Bash(…)` only when the log shows a denied useful command — then note it in the debrief.

---
name: grok-it
description: Delegate any task — research, implementation, adversarial testing — to a headless grok CLI in an isolated worktree. The chief only briefs, launches, and judges (never implements). Use when the user says "grok it", "send grok", or wants the intern doing the work.
---

# /grok-it — the chief does absolutely nothing

**We have a massive deal with grok. The mandate: play around with it and push how far we can harness its intelligence.** So the chief — Claude, Grok Build, whoever is reading this — never does the work. Write the brief, stage the coop, launch a headless grok, judge the result. That's the whole job.

If *you* are Grok: still the chief. Launch a **fresh** headless goose into a worktree. Do not "save a hop" by implementing in this session. Isolation is the product; self-trust is the bug. 🪿

## The launch (learned the hard way)

The block below is a **starting recipe**, not a straitjacket. Different tasks need different allows (read-only research vs draft-PR implementation). **Try things.** Widen read/search allows when the intern keeps asking; tighten when it wanders. Log what worked so `/what-did-i-just-grok` can harvest it.

```bash
# 1. Stage the coop (house style — sibling path, not grok --worktree)
git worktree add ../vajra-grok-<task> -b grok/<task> main
(cd ../vajra-grok-<task> && pnpm install)

# 2. Write the brief to disk (shell quoting eats inline -p briefs)
#    → ../vajra-grok-<task>/.grok-brief.md

# 3. Launch headless; run in background and watch the output
grok --prompt-file ../vajra-grok-<task>/.grok-brief.md \
  --cwd=../vajra-grok-<task> --check --max-turns 200 \
  --allow "Edit" --allow "Write" --allow "Read" --allow "Grep" \
  --allow "Bash(pnpm *)" --allow "Bash(git *)" \
  --allow "Bash(gh pr create *)" \
  --allow "Bash(grep *)" --allow "Bash(rg *)" --allow "Bash(find *)" \
  --allow "Bash(diff *)" --allow "Bash(ls *)" --allow "Bash(cat *)" \
  --allow "Bash(head *)" --allow "Bash(tail *)" --allow "Bash(wc *)" \
  --allow "Bash(sort *)" --allow "Bash(uniq *)" --allow "Bash(tree *)" \
  --allow "Bash(jq *)" --allow "Bash(file *)" --allow "Bash(which *)"
```

- **Never `--always-approve` / `--yolo`** — scoped allows, not the nuclear option. Add/remove allows per task; the list above is "harmless + useful for shop-app dev," not the only legal set.
- Brief says "deps installed, do NOT run `pnpm install`."
- Prefer `--prompt-file` over `grok -p "..."`. Long decision-complete briefs die in shell quoting.
- Skip `grok --worktree` here — sibling `../vajra-grok-<task>` is findable, cleanable, and matches existing coops. Stage + `pnpm install` yourself so the intern never hits a wall on wake.
- **Headless grok is timid with vague prompts** — one clarifying question and exits. Briefs must be decision-complete: issue body AND comments (comments override, newest wins), pointers to `AGENTS.md` / `CONTEXT.md`, domain landmines (money is integer paise, mass is grams). Fork-heavy features: `/to-prd` first, brief from the PRD.
- **Every brief ends with a stop clause.** Code work: "run `pnpm fix:headless` until green, commit on this branch with a conventional message, push, open a **draft** PR with `gh pr create --draft` disclosing provenance ('implementation by grok CLI — pending verification'), then STOP. No marking ready, no merging, no new tasks." Read-only (research, wrecking-ball testing): "no push, no PR."
- Hard problem? `--best-of-n N` races N attempts headless and keeps the best.

### Brief skeleton (required shape)

```markdown
# Task
<one sentence>

# Sources
- Issue #N body + comments (newest wins): <paste or summarize decisions>
- CONTEXT.md vocabulary; AGENTS.md rules
- Landmines: money = integer paise; mass = grams

# Do
<decision-complete steps; name behaviours, not file paths unless essential>

# Do not
<out of scope; no drive-by refactors>

# Stop
<stop clause from above>
```

## Relay stations — any work → grok

These are **common plays**, not a closed menu. Invent a station when the work demands it (docs-only, bisect, perf, …) as long as the chief still only briefs / launches / judges.

- **Research?** Grok. Read-only brief: return findings as markdown, commit nothing. Drop `Edit`/`Write`/`gh` allows if you want the coop locked.
- **Implementation?** Grok. PRD/issue brief, docs duty included: "if vocabulary shifts, update CONTEXT.md to match."
- **Testing?** A **new** grok in the same worktree, briefed to _break the previous grok's code_: aggressive smoke + unit tests hunting real cracks (money rounding, stock deltas, mode toggles, empty/boundary carts). Wrecking-ball tests are for finding bugs — they get reported, then deleted; only the few high-value ones earn a commit (AGENTS.md test philosophy).
- **Cleanup?** Grok, same worktree, briefed to sweep the previous grok's diff for debris: dead code, debug logs, commented-out blocks, unused exports, stale docs. Behavior identical — `pnpm fix:headless` proves it.
- **Simplify?** Grok on the diff hunting reuse, simplification, and efficiency wins — quality only, no bug hunt (that's the Testing grok's game). If a change isn't clearly simpler, it doesn't land.
- Bugs found → written into a fresh brief for the next implementation grok. We do not fix them ourselves.

Each grok is a fresh instance that never trusts the previous grok's claims. Add `--no-subagents` if one gets ideas about hiring its own interns — the buck stops somewhere. 🪿

## Judging — only when absolutely necessary

The chief verifies exactly three things, nothing more:

1. **Green for real**: read the `ci` check on the draft PR, not the transcript. CI runs `pnpm verify:headless` on every PR (#97) — grok already paid for green once with `fix:headless`, so the same commit never earns a second local run. `gh pr checks <pr> --watch`, then move on. Local rerun only if CI itself is what's broken.
2. **Diff matches brief**: read it. Nothing beyond scope, nothing missing, glossary words used.
3. **It stayed home**: the transcript never touches paths outside its worktree.

Pass → chief marks the draft ready (`gh pr ready`), noting "verified by \<chief\>" on the PR (Claude, Grok Build, …). Fail → close the draft PR, the failure becomes the next brief, and another goose takes flight.

## After everything — debrief

When the flight is done (PR ready, abandoned, or research returned): run **`/what-did-i-just-grok`**. That skill turns the mess into durable lessons — what the brief missed, which allows mattered, where the goose wandered. Do not skip it; the mandate is to *learn* how far we can push grok, not only to ship.

## Cleanup — leave the coop tidy

Once the PR is merged or abandoned: `git worktree remove ../vajra-grok-<task>` and delete the local branch. Stale worktrees are how geese nest permanently. Drop `.grok-brief.md` with the worktree — it is not product source. Debrief first (`/what-did-i-just-grok`), then burn the coop.

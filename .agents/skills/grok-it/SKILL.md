---
name: grok-it
description: Delegate any task — research, implementation, adversarial testing — to the grok CLI in an isolated worktree. Claude only briefs, launches, and judges. Use when the user says "grok it", "send grok", or wants the intern doing the work.
---

# /grok-it — we do absolutely nothing

**We have a massive deal with grok. The mandate: play around with it and push how far we can harness its intelligence.** So Claude never does the work. Claude writes the brief, sets the stage, launches grok, and judges the result. That's the whole job.

## The launch (learned the hard way)

```
grok -p "<BRIEF>" --cwd=<worktree> --check --max-turns 200 \
  --allow "Edit" --allow "Write" --allow "Bash(pnpm *)" --allow "Bash(git *)"
```

- Run in the background; watch the output file. **Never `--always-approve`** — scoped allows are all it needs.
- **Stage first so it never hits a wall**: fresh worktree off main (`git worktree add ../vajra-grok-<task> -b grok/<task> main`) and `pnpm install` before launch. Brief says "deps installed, do NOT run pnpm install."
- **Headless grok is timid with vague prompts** — it asks one clarifying question and exits. Briefs must be decision-complete: issue body AND comments (comments override, newest wins), pointers to AGENTS.md/CONTEXT.md, and the domain landmines spelled out (money is integer paise, mass is grams). For fork-heavy features, run `/to-prd` first and brief from the PRD.
- **Every brief ends with a stop clause**: "run `pnpm fix:headless` until green, commit on this branch with a conventional message, then STOP. No push, no PR, no new tasks."
- Hard problem? `--best-of-n N` races N attempts headless and keeps the best.

## Relay stations — any work → grok

- **Research?** Grok. Read-only brief: return findings as markdown, commit nothing.
- **Implementation?** Grok. PRD/issue brief, docs duty included: "if vocabulary shifts, update CONTEXT.md to match."
- **Testing?** A **new** grok in the same worktree, briefed to *break the previous grok's code*: aggressive smoke + unit tests hunting real cracks (money rounding, stock deltas, mode toggles, empty/boundary carts). Wrecking-ball tests are for finding bugs — they get reported, then deleted; only the few high-value ones earn a commit (AGENTS.md test philosophy).
- Bugs found → written into a fresh brief for the next implementation grok. We do not fix them ourselves.

Each grok is a fresh instance that never trusts the previous grok's claims. Add `--no-subagents` if one gets ideas about hiring its own interns — the buck stops somewhere. 🪿

## Judging — only when absolutely necessary

Claude verifies exactly three things, nothing more:

1. **Green for real**: run `pnpm verify:headless` yourself. The transcript's word is not evidence.
2. **Diff matches brief**: read it. Nothing beyond scope, nothing missing, glossary words used.
3. **It stayed home**: the transcript never touches paths outside its worktree.

Pass → Claude opens the PR, provenance disclosed ("implementation by grok CLI, verified by Claude"). Fail → the failure becomes the next brief, and another goose takes flight.

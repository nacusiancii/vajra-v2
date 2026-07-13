---
name: what-did-i-just-grok
description: Debrief a finished /grok-it flight — extract lessons from brief, transcript, diff, and CI so the next launch is sharper. Use when the user says "what did I just grok", after a grok-it run completes, or when /grok-it points the chief here.
---

# /what-did-i-just-grok — the chief learns (for once)

`/grok-it` made you do nothing. This skill makes that nothing *useful*. After a headless goose lands (or crashes), the chief reads the wreckage and writes down what actually happened — so the next brief, allow list, and relay choice are less guesswork.

You still do not re-implement the task. You **observe, name, and keep**.

## When to run

Immediately after a `/grok-it` flight ends: draft PR ready or closed, research markdown returned, wrecking-ball report in, or the intern died mid-turn. Prefer before deleting the worktree — the transcript and `.grok-brief.md` live there.

## Inputs (gather what exists)

| Artifact | Where |
|----------|--------|
| Brief | `../vajra-grok-<task>/.grok-brief.md` |
| Worktree + branch | `../vajra-grok-<task>`, `grok/<task>` |
| Diff | `git -C <worktree> log main..HEAD` + `git diff main...HEAD` |
| Draft PR | `gh pr view` / checks |
| Transcript / session | headless stdout, `grok sessions`, or the background log the chief watched |
| Launch line | the exact `grok ... --allow ...` the chief used |

Missing pieces are fine — note the gap; do not invent a transcript you did not see.

## Debrief (answer in order)

Write a short debrief (chat is enough unless the user asks for a file). Keep it sharp; no novel.

1. **Mission** — one line: what we sent the goose to do, and which relay (research / implement / test / cleanup / simplify / other).
2. **Outcome** — shipped draft PR? closed? findings only? hung on a clarifying question? CI green/red?
3. **Brief autopsy** — what was underspecified, wrong, or gold? Would a sharper stop clause or landmine have changed the path?
4. **Allow list** — which permissions were load-bearing? Which were unused theatre? What did the intern need that we forgot (e.g. `Grep`, `Bash(rg *)`, `Bash(diff *)`)? What should we **never** open for this class of task?
5. **Wander log** — scope creep, glossary sins, paths outside the worktree, hired sub-interns, drive-by refactors. Quote evidence when you have it.
6. **Judging call** — did the three checks (CI / diff↔brief / stayed home) catch a real problem, or did something slip through?
7. **Keep / change / drop** — three bullets max for the *next* `/grok-it` of this shape:
   - **Keep:** patterns that worked
   - **Change:** brief shape, allows, relay order, `--best-of-n`, max-turns
   - **Drop:** ritual that wasted turns

## Optional durable capture

Only if a lesson will matter beyond this chat:

- Update `/grok-it` itself when a launch rule was wrong (e.g. a new harmless allow that repeatedly unblocked real work) — small PR, not a novel.
- Domain vocabulary or ADR shifts belong in `/grill-with-docs`, not here.
- Do **not** commit the debrief into product source by default; user can ask for a note in the PR body or a docs tweak.

## Anti-goals

- No rewriting the intern's code "while we're here."
- No second full `pnpm verify:headless` if CI already spoke (#97).
- No pretending the flight was fine when judging failed — failure *is* the lesson.

## Done

Hand the user the debrief. Suggest the next move in one line (re-brief, mark ready, abandon coop, or open a follow-up issue). Then the chief may burn the worktree per `/grok-it` cleanup.

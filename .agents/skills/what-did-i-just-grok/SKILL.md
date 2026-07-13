---
name: what-did-i-just-grok
description: Fill a short debrief form after a /grok-it flight so the next launch is easier. Use when the user says "what did I just grok", after grok-it finishes, or when /grok-it says to debrief.
---

# /what-did-i-just-grok — 2-minute debrief

Do this **before** deleting the worktree. Do **not** re-implement anything. Paste the form into chat with blanks filled.

## Form (copy + fill)

```markdown
## Debrief: grok/<task>

**Mission:** <one line — what we asked for>
**Play:** implement | research | test | cleanup | simplify | other
**Outcome:** draft PR ready | draft closed | findings only | died mid-flight
**PR / CI:** <link or n/a> — green | red | n/a

**Brief:** good enough | too vague | too narrow
- Fix next time: <one line or "none">

**Allows:** default list fine | needed more | too open
- Change next time: <e.g. add Bash(foo *) / none>

**Wander?** no | yes — <scope creep / left worktree / glossary / other>

**Next time keep:** <one thing>
**Next time change:** <one thing>
**Next move:** mark ready | re-brief | abandon coop | open issue
```

## If something is missing

Skip that line. Do not invent a transcript. Glance at `.grok-brief.md`, `git diff main...HEAD`, and the log you already have — no deep archaeology unless the user asks.

## Done

Show the filled form. One-line next move. Then the chief may burn the coop (`git worktree remove …`).

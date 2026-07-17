# Fixed footer (every implement / fix brief)

Megathread: #123 (Next Alpha Release). Related issues may be stale — prefer this megathread.

Read `CONTEXT.md` + `AGENTS.md` / `CLAUDE.md`. Money = integer paise; mass = grams.
Deps are already installed in this worktree — do **not** run `pnpm install`.
Do **not** run `pnpm verify`, `pnpm test:smoke`, or any full local smoke — CI is the heavy check.

## Quality gate

After edits, run **`pnpm agent:check:autofix`** until it exits 0 (lint:fix + format + typecheck, flock-serialised).

## Land

1. Conventional commit message focused on this task only.
2. `git push -u origin HEAD` (or push existing upstream).
3. Open a **draft** PR if none exists:
   - Title: `mt123: <task line>`
   - Body must include: `Closes` nothing unless the whole megathread is done; link `#123`; note "implementation by grokflow — pending interactive review".
4. **UI changes:** commit PNG screenshots under `.pr-screenshots/<branch-slug>/` and link them in the PR body (raw.githubusercontent or `blob` URLs on this branch). Best-effort if capture is impractical; leave a PR note if skipped.
5. **STOP.** No mark-ready, no merge, no second task, no drive-by refactors.

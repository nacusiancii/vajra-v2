# Project Vajra (v2)

A from-scratch redesign of [`archive/v1`](./archive/v1/README.md): a desktop inventory + daily-operations app for a wholesale grocery and pulses shop in Andhra Pradesh, India.

v1 reached a working cash-sale prototype on Electron + Vue + Tailwind 4 + shadcn-vue. v2 keeps the product intent but rebuilds the foundation with three explicit goals:

1. **Better developer experience** — fast dev loop, ergonomic tooling, clear seams.
2. **Better data model** — domain-first, designed before code, captured in `CONTEXT.md` and ADRs.
3. **Better architecture** — boundaries that survive new features, not retrofitted around prototypes.

## Working style

- **PRD-first.** Every non-trivial feature starts as a PRD under `.scratch/<feature>/PRD.md` before code is touched. Use `/to-prd` to draft.
- **Issues are decomposed PRDs.** Use `/to-issues` to slice a PRD into numbered issues under `.scratch/<feature>/issues/`.
- **Decisions are durable.** Architectural choices land as ADRs under `docs/adr/` via `/grill-with-docs`. Domain vocabulary lives in `CONTEXT.md`.
- **v1 is read-only reference.** `archive/v1/` exists to learn from — don't import code blindly. Pull patterns deliberately, with a written reason.

## Repo layout (so far)

```
/
├── CLAUDE.md                 ← this file
├── archive/v1/               ← previous iteration, gitignored
├── docs/agents/              ← config for Matt Pocock's engineering skills
├── matt-pocock-skills/       ← vendored skills repo, gitignored
└── .scratch/                 ← PRDs + issues (created on first /to-prd run)
```

`CONTEXT.md` and `docs/adr/` get created lazily by `/grill-with-docs` as terms and decisions actually resolve. Don't pre-populate.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

Five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) — defaults, no remapping. See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See [`docs/agents/domain.md`](./docs/agents/domain.md).

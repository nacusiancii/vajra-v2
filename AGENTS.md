# Project Vajra (v2)

Desktop app for a wholesale grocery and pulses shop in Andhra Pradesh, India. Runs the current business day — stock, sales, slips, end-of-day rollover. Not a long-term ledger. Use the shopkeeper's vocabulary as it emerges in `CONTEXT.md`.

## v2's goals

v1 became prototype-as-architecture. v2 rebuilds the foundation:

1. Data model designed before code.
2. Architecture that survives new features.
3. Developer experience — fast loop, clear seams.

## How we work

### Design & exploration

- **Weigh prior art, systems, and what's practical.** A design fork deserves real thought before a decision, not one produced on demand.
- **Grilling assumes a plan.** `/grill-me` / `/grill-with-docs` pressure-test a plan that already exists; they don't form one.
- **Prototype for a hands-on feel** (`/prototype`) when the fork is about how something should feel, not just what it should do.
- Small, clear changes skip all this and go straight to code.

### Development

- **Decisions are durable** — architectural choices → ADRs in `docs/adr/`. Domain vocabulary → `CONTEXT.md`. Both created lazily by `/grill-with-docs`. Don't pre-populate.
- **Use the glossary's words.** Missing term = flag it, don't invent a synonym.
- **Contradicting an ADR?** Say so explicitly. Don't silently override.
- **Tests: few high-value beats many low-value.** Protect real cashier paths and hard domain invariants; skip large suites that rot. Too early for deep unit coverage everywhere — light unit tests only in **critical** areas (Inventory projection, money/stock rules, Draft isolation from the ledger) when a silent failure would be expensive. Prefer smoke/E2E for multi-step counter flows. Do not add tests that only restate the implementation.

And most importantly, if you do end up touching code, leave it in a better state than what you started with 😄.

Before considering a change done, run **`pnpm fix`** (lint:fix + format only), then push and let CI verify. CI runs on every push — watch with `gh run watch` / `gh pr checks --watch`. Reserve `pnpm verify` / `pnpm test:smoke` for local debugging when you can't rely on CI.

## Code map & invariants

Layers, top to bottom (full tree in [README → Project structure](./README.md#project-structure)):
`src/domain/` pure types + rules → `src/shared/` typed IPC contract → `src/main/` Electron main + SQLite repositories → `src/preload/` context bridge → `src/renderer/` Vue 3 app.

Rules that break silently if you don't know them:

- **Money is integer paise; mass is integer grams.** Rupees and kg exist only at the UI boundary — convert with the helpers in `src/domain/units.ts`. No float money in the ledger (ADR-0006).
- **Domain stays pure.** `src/domain/` imports nothing from Electron, Node, SQLite, or the other layers. Convention, not lint-enforced — keep it that way.
- **The IPC contract is one file.** Every renderer→main call is a method on `VajraApi` in `src/shared/api.ts`; preload exposes it, main implements it. Change the contract first, then both sides.
- **Inventory is a projection, never stored.** `projectInventory` in `src/domain/transaction.ts` replays the day's ledger over Opening Stock (ADR-0005). Never persist a current-stock column.
- **Bumping `SCHEMA_VERSION` wipes the database.** `src/main/db.ts` recreates any older `user_version` from scratch — no migrations during alpha. Bump only on a schema change, and say so in the PR.

## Agent skills

### Issue tracker

GitHub Issues, via the `gh` CLI. Big features are tracked as `epic` parent issues. See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

Defaults — `triage-done`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Unlabeled issues need evaluation (no label required at creation). See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at repo root. See [`docs/agents/domain.md`](./docs/agents/domain.md).

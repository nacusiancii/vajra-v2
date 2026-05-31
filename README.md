# Project Vajra (v2)

Desktop app for a wholesale grocery and pulses shop in Andhra Pradesh, India. Runs the current Business Day — stock, sales, slips, end-of-day Rollover. Built with Electron, Vue 3, TypeScript, and Tailwind.

## Prerequisites

- Node 24 (see `.nvmrc`)
- pnpm 10+

Linux only:

```bash
sudo apt install build-essential python3 make g++
```

## Setup

```bash
pnpm install
pnpm approve-builds   # if prompted for native module builds
```

If `electron` binary is missing after install:

```bash
node node_modules/.pnpm/electron@*/node_modules/electron/install.js
```

## Development

```bash
pnpm dev
```

On Linux, if the sandbox blocks launch:

```bash
ELECTRON_DISABLE_SANDBOX=1 pnpm dev
```

## Verification

The single command that gates all work:

```bash
pnpm verify
```

This runs lint, typecheck, unit tests (domain validation, pricing, and the Inventory
projection), and Playwright smoke tests (master data + the full transactional core).

### Scripts

```bash
- `pnpm test` — run unit tests (pure domain logic, no Electron, fast)
- `pnpm test:smoke` — build then run Playwright smoke tests against the real Electron app
- `pnpm verify` — full check: lint:fix → typecheck → unit tests → smoke tests
```

Refer to @package.json for the complete list of scripts, use pnpm, avoid npm and npx.

## Adding shadcn-vue components

```bash
pnpm dlx shadcn-vue@latest add <component-name>
```

Components land in `src/renderer/src/components/ui/`.

## Project structure

```
src/
├── domain/        Pure types + logic (validation, pricing, Inventory projection) — no Electron
├── shared/        Typed IPC contract (channels + VajraApi)
├── main/          Electron main process
│   └── repositories/   SQLite-backed data access (customers, products, transactions, …)
├── preload/       Context bridge (exposes VajraApi to the renderer)
└── renderer/      Vue 3 app
    └── src/
        ├── assets/       Tailwind CSS
        ├── components/   shadcn-vue UI primitives + transaction widgets
        ├── lib/          Utilities (cn, formatting, EOD report)
        ├── queries/      Vue Query composables over the IPC API
        ├── stores/       Pinia UI state
        ├── views/        Route-level pages
        └── router.ts     Vue Router config
tests/
├── unit/          Vitest — pure domain logic (no Electron)
└── smoke/         Playwright — the real Electron app end-to-end
```

The day's stock, sales, slips, money movements, and end-of-day Rollover all run through
the transactional core. See `.scratch/04-transactional-core/DESIGN.md` for the data model
and the decisions taken in this build.

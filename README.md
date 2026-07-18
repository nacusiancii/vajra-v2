# Project Vajra (v2)

Desktop app for a wholesale grocery and pulses shop in Andhra Pradesh, India. Runs the current Business Day — stock, sales, slips, end-of-day Rollover. Built with Electron, Vue 3, TypeScript, and Tailwind.

**License:** [FSL-1.1-ALv2](./LICENSE.md) (Functional Source License — source-available; each version becomes Apache-2.0 after two years). Free for your own shop and most non-competing uses; not for offering a competing product or service. See the license for the full terms.

**Contributing:** See [CONTRIBUTING.md](./CONTRIBUTING.md). External PRs require a signed [CLA](./CLA.md).

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

Default path — `pnpm fix` is lint:fix + format only; CI runs the full suite on every push
(not just PRs). Prefer this over local `pnpm verify` so local smoke does not compete for
RAM across worktrees:

```bash
pnpm fix
git push
gh run watch   # or: gh pr checks --watch once a PR exists
```

Local verification is for debugging when you can't rely on CI. Headless needs `xvfb`:

```bash
sudo apt install xvfb   # once, Linux
pnpm verify:headless
# or with visible Electron windows:
pnpm verify
```

That runs lint, typecheck, unit tests (domain validation, pricing, Inventory projection),
and Playwright smoke (master data + transactional core). Smoke defaults to 1 worker
locally (4 in CI) — override with `PLAYWRIGHT_WORKERS=<n>` or
`pnpm test:smoke -- --workers=<n>`.

### Scripts

```bash
- `pnpm test` — unit tests (pure domain logic, no Electron, fast)
- `pnpm test:smoke` — build + Playwright smoke (visible Electron windows)
- `pnpm test:smoke:headless` — same, under Xvfb (no window flash)
- `pnpm verify:static` — lint ∥ typecheck ∥ unit (no Electron)
- `pnpm verify` / `pnpm verify:headless` — static then smoke
- `pnpm fix` — lint:fix → format (no verify)
- `pnpm agent:check:autofix` — flock-serialised lint:fix + format + typecheck (for parallel fleet agents)
- `pnpm release:alpha` — maintainer: bump alpha, PR, tag, trigger Windows build
```

CI runs `static` and `smoke` as parallel jobs on every push and PR. Refer to
@package.json for the complete list; use pnpm, avoid npm and npx.

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
the transactional core. Domain vocabulary lives in [CONTEXT.md](./CONTEXT.md); durable
architecture decisions live in [docs/adr/](./docs/adr/).

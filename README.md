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

This runs typecheck, unit tests (placeholder for now), and Playwright smoke tests.

### Individual commands

```bash
pnpm typecheck       # TypeScript across main + renderer
pnpm test            # Unit tests (vitest, coming later)
pnpm test:smoke      # Build + Playwright Electron smoke tests
```

## Adding shadcn-vue components

```bash
pnpm dlx shadcn-vue@latest add <component-name>
```

Components land in `src/renderer/src/components/ui/`.

## Project structure

```
src/
├── main/          Electron main process
├── preload/       Context bridge (typed API surface)
└── renderer/      Vue 3 app
    └── src/
        ├── assets/       Tailwind CSS
        ├── components/   shadcn-vue UI primitives
        ├── lib/          Utilities (cn, etc.)
        ├── views/        Route-level pages
        └── router.ts     Vue Router config
tests/
└── smoke/         Playwright Electron smoke tests
```

# Contributing to Vajra

Vajra is a desktop app for a wholesale grocery and pulses shop. It is
**source-available** under the [Functional Source License 1.1 (Apache-2.0 future
license)](./LICENSE.md) — not OSI open source until each version ages two years.
See the license for permitted vs competing use.

Contributions are welcome, but this is a tightly scoped shop tool. Small,
high-value fixes and clear domain improvements beat large speculative features.

## Before you start

1. Read [CONTEXT.md](./CONTEXT.md) for domain vocabulary. Use those words; don't
   invent synonyms.
2. Skim [docs/adr/](./docs/adr/) if your change touches architecture.
3. Prefer a short issue discussion before large PRs.

## CLA (required)

All external contributions require a signed
[Contributor License Agreement](./CLA.md). The CLA lets the maintainer relicense
or dual-license the project later (including moving to full open source or a
more closed product line) without hunting down every past contributor.

On your first PR, the CLA workflow will comment with signing instructions.
Sign by posting exactly:

```text
I have read the CLA Document and I hereby sign the CLA
```

Bots and the maintainer account are allowlisted and do not need to sign.

## Development

Prerequisites and scripts are in [README.md](./README.md).

```bash
pnpm install
pnpm approve-builds   # if prompted for native modules
pnpm dev              # or ELECTRON_DISABLE_SANDBOX=1 pnpm dev on Linux
```

Before opening a PR, run:

```bash
pnpm fix
```

That fixes lint issues and formats. Push and open the PR — CI lints, typechecks,
unit-tests, and runs Playwright smoke tests on every push, so `gh pr checks --watch`
confirms green without running the Electron suite on your own machine.

## Pull requests

- Keep PRs focused; one concern per PR when practical.
- Match existing style and domain language.
- Prefer smoke/E2E coverage for multi-step cashier flows; light unit tests only
  where silent failure is expensive (Inventory projection, money/stock rules,
  Draft isolation).
- Do not add secrets, real shop data, or personal customer information.
- Do not commit `node_modules/`, `out/`, `dist/`, or local DB files.

## What we are unlikely to merge

- Multi-tenant / cloud / auth systems that contradict
  [ADR 0002](./docs/adr/0002-single-machine-offline-no-auth.md)
- Long-term ledger features that contradict
  [ADR 0001](./docs/adr/0001-zero-retention-beyond-the-business-day.md)
- Drive-by dependency churn without a clear fix

## Security

See [SECURITY.md](./SECURITY.md). Do not open public issues for sensitive
vulnerabilities.

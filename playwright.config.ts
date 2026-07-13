import { defineConfig } from '@playwright/test'

// Each smoke test launches its own Electron with an isolated VAJRA_USER_DATA
// dir (no single-instance clash), so workers can run in true parallel. CI's
// ubuntu-latest (4 vCPU / 16 GB) is otherwise idle and defaults wider; local
// dev boxes are often running other memory-hungry things (an editor, a dev
// server, another worktree's smoke run) so default to 1. Override with
// `PLAYWRIGHT_WORKERS=<n> pnpm test:smoke` or `pnpm test:smoke -- --workers=<n>`
// (the CLI flag wins over both).
const workers = process.env.PLAYWRIGHT_WORKERS
  ? Number(process.env.PLAYWRIGHT_WORKERS)
  : process.env.CI
    ? 4
    : 1

export default defineConfig({
  testDir: './tests/smoke',
  outputDir: './test-results/artifacts',
  timeout: 30_000,
  retries: 0,
  fullyParallel: true,
  workers,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
})

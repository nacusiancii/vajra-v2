import { defineConfig } from '@playwright/test'

// Public ubuntu-latest is 4 vCPU / 16 GB. Electron is heavy; 2 workers on CI
// balances wall-clock vs memory. Local defaults to 4 for a faster feedback loop.
const workers = process.env.CI ? 2 : 4

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

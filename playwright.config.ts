import { defineConfig } from '@playwright/test'

// Public ubuntu-latest is 4 vCPU / 16 GB. Each smoke test launches its own
// Electron with an isolated VAJRA_USER_DATA dir (no single-instance clash), so
// 4 workers match the runner width. Dial back only if CI OOMs or flakes.
const workers = 4

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

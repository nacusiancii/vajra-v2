import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/smoke',
  outputDir: './test-results/artifacts',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
})

import { defineConfig } from '@playwright/test'

// Screenshot harness config (#106). Separate from playwright.config.ts so the
// screenshot spec never runs as part of `pnpm test:smoke`, and smoke never
// pays for it. Entry point: `pnpm screenshot <route>` (scripts/screenshot.sh).
export default defineConfig({
  testDir: './tests/screenshot',
  outputDir: './test-results/screenshot',
  timeout: 60_000,
  retries: 0,
  // One Electron per route; serial keeps RAM flat on a dev box.
  workers: 1,
  reporter: [['list']],
  use: { trace: 'off', screenshot: 'off' }
})

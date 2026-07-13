---
name: electron-app-testing
description: Write and maintain Playwright smoke/e2e tests for the Vajra Electron desktop app. Use when adding smoke tests, debugging test failures, creating new test fixtures, or asking about Electron automation testing best practices.
---

# Electron App Testing

## Quick start

**Default (headless — no window flash):**

```bash
pnpm test:smoke:headless
# or verify only:
pnpm verify:headless
```

Requires Xvfb once on Linux: `sudo apt install xvfb`. Smoke tests default to 1 worker
locally (CI defaults to 4) — override with `PLAYWRIGHT_WORKERS=<n>` or
`pnpm test:smoke:headless -- --workers=<n>`. CI runs on every push, so prefer pushing
and checking `gh run watch` / `gh pr checks --watch` over running the full suite locally.

**Visible UI** (when debugging a smoke failure and you want to see the app):

```bash
pnpm test:smoke
# or
pnpm verify
```

Both paths build the app first (`electron-vite build`) then launch Playwright against the production bundle. Headless wraps Playwright in `xvfb-run` via `scripts/run-playwright-headless.sh`.

## Fixture pattern

Tests import a custom fixture from `tests/smoke/fixtures.ts` that handles the hard parts:

```ts
import { test, expect } from './fixtures'

test('something works', async ({ page }) => {
  await expect(page.getByTestId('home-page')).toBeVisible()
})
```

The fixture provides `electronApp` and `page`. You write assertions against `page`.

## Principles

1. **Build before test.** Always test the production bundle, not the dev server. The smoke scripts handle this.
2. **Isolate user data.** Each test gets a fresh temp directory (`VAJRA_USER_DATA` env). No shared state between tests.
3. **Centralize launch details.** Electron path, sandbox env, user data dir, and cleanup live in the fixture — not in test files.
4. **Assert public UI.** Use `data-testid`, roles, and visible text. Never reach into IPC channels, Electron internals, or DOM implementation details.
5. **Few tests, high signal.** Smoke tests should cover "the app starts and navigates" — not every edge case. Keep the suite under 30 seconds.
6. **Collect artifacts on failure.** Playwright config enables screenshots on failure and traces on retry. Check `test-results/artifacts/` after a red run.
7. **Handle Linux sandbox.** The fixture sets `ELECTRON_DISABLE_SANDBOX=1` so tests run on Linux without `--no-sandbox` flags leaking into production code.
8. **Prefer CI over local runs.** CI runs the full smoke suite on every push; check it with `gh run watch` / `gh pr checks --watch` instead of running the Electron suite locally, especially across multiple worktrees at once — local runs share one box's RAM. When you do need to run locally, prefer `:headless` scripts so Electron windows do not flash on the desktop; use non-headless only to watch the UI while debugging. Do not reach for Docker just to hide windows. On Wayland desktops, headless must unset `WAYLAND_DISPLAY` and force X11 (`GDK_BACKEND` / `--ozone-platform=x11`); Xvfb alone is not enough.

## Adding a new smoke test

1. Open `tests/smoke/app-shell.spec.ts` (or create a new `.spec.ts` in the same directory).
2. Import from `./fixtures`.
3. Write the test against `page` — use Playwright locators.
4. Add `data-testid` attributes to Vue templates if needed for stable selectors.
5. Run `pnpm test:smoke:headless` to verify (or `pnpm test:smoke` if you want to watch the UI).

## Locator strategy

Prefer (in order):

- `getByRole()` — accessible and resilient
- `getByTestId()` — explicit contract between test and template
- `getByText()` — only when unambiguous within scope

Avoid: CSS selectors, XPath, or anything that couples to implementation structure.

## Checklist for new test files

- [ ] Uses fixture import, not raw `@playwright/test`
- [ ] Does not launch Electron manually
- [ ] Assertions target visible behavior
- [ ] No hardcoded waits (`waitForTimeout`) — use Playwright auto-waiting
- [ ] Test name describes user-facing behavior

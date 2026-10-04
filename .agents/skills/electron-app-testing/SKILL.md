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

Requires Xvfb once on Linux: `sudo apt install xvfb`. Smoke defaults to 1 worker locally
(4 in CI) — override with `PLAYWRIGHT_WORKERS=<n>` or
`pnpm test:smoke:headless -- --workers=<n>`.

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
5. **Smoke protects counter flows, not edge cases.** Multi-step cashier paths (seed a product → purchase → sell → check Inventory, park/resume a Draft, settle a Receipt, export EOD) belong here, driven through the UI end-to-end and asserting what the shopkeeper sees. This is where `AGENTS.md` sends them — don't push them down into unit tests. Variations, validation edge cases, and pure money/stock rules belong in light unit tests under `tests/unit/`. Each test boots its own Electron, so tests are not free: extend the flow's existing spec rather than add a near-duplicate, and raise `test.setTimeout` only for genuinely long flows. Keep the whole suite around a minute on CI's 4 workers; if it creeps well past that, consolidate before adding more.
6. **Collect artifacts on failure.** Playwright config enables screenshots on failure and traces on retry. Check `test-results/artifacts/` after a red run.
7. **Handle Linux sandbox.** The fixture sets `ELECTRON_DISABLE_SANDBOX=1` so tests run on Linux without `--no-sandbox` flags leaking into production code.
8. **Prefer headless.** Use `:headless` so Electron windows do not flash. Use non-headless only to watch the UI while debugging. Do not reach for Docker just to hide windows. On Wayland desktops, headless must unset `WAYLAND_DISPLAY` and force X11 (`GDK_BACKEND` / `--ozone-platform=x11`); Xvfb alone is not enough. The wrapper also pins the Xvfb screen to 1366x768 and `GDK_SCALE=1`: xvfb-run's default screen differs per distro (Arch is 640x480) and HiDPI sessions export `GDK_SCALE=2`, and either one shrinks the viewport until dialog buttons fall outside it and clicks time out. Override the screen with `VAJRA_XVFB_SCREEN=WxHxD`.

## Seeing a route: `pnpm screenshot`

Agents can ship UI changes but cannot see them. The screenshot harness boots the built app
on the same fixture the smoke suite uses, opens a route, and writes a PNG you can `Read()`:

```bash
pnpm screenshot /sale                 # → screenshots/sale.png
pnpm screenshot / /settings /rollover # one build, one PNG per route
VAJRA_SKIP_BUILD=1 pnpm screenshot /journal   # reuse out/ when only re-looking
```

- Output: `screenshots/<slug>.png` at repo root (gitignored). `/` → `home.png`;
  `/sale?mode=credit` → `sale-mode-credit.png`. Same route overwrites, so the path is
  predictable and nothing accumulates. The absolute path is printed on success.
- Headless under Xvfb when `xvfb-run` exists (same wrapper as `test:smoke:headless`);
  otherwise it warns and opens a visible window briefly.
- Window content is pinned to 1366x768 (shop laptop); capture is full-page so tall carts are
  not cut off. Override with `VAJRA_SCREENSHOT_VIEWPORT=WxH`.
- Readiness: waits for the view root (`data-testid` ending in `-page`) and web fonts. For a
  route or dialog without one, pass `VAJRA_SCREENSHOT_WAIT=<testid>`. A missing root fails in
  a few seconds, not the full timeout, and the error says whether the route rendered nothing
  (not in `router.ts`) or rendered without a root (lists the testids present).
- State is a fresh, empty user data dir — exactly what the smoke fixture gives. Seeded
  states (an open cart, a slip preview) are not in scope yet; for those, write an opt-in
  smoke spec that navigates and calls `page.screenshot()` (see the #115 prototype notes in
  issue #106).

Files: `scripts/screenshot.sh` → `playwright.screenshot.config.ts` →
`tests/screenshot/screenshot.spec.ts`. The spec lives outside `tests/smoke/` so it never runs
as part of smoke, and it imports `fixtures.ts` unchanged.

## Adding a new smoke test

1. Add to the spec for that flow (e.g. `sale-draft.spec.ts`), or create `tests/smoke/<flow>.spec.ts` for a new one. `app-shell.spec.ts` is only for the shell itself (window, Home, Settings, navigation).
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

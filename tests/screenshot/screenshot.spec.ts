import path from 'node:path'
import fs from 'node:fs'
import { test, expect } from '../smoke/fixtures'
import type { Page } from '@playwright/test'

/**
 * Screenshot harness (#106) — lets an agent *see* a route it just changed.
 *
 * Not a smoke test and not visual regression: nothing is asserted beyond
 * "the app booted and the route rendered". One Electron boot per route, on the
 * same fixture the smoke suite uses, so launch quirks (sandbox, Xvfb/X11,
 * isolated user data) stay in one place.
 *
 * Driven by `scripts/screenshot.sh` (`pnpm screenshot <route>...`) through env:
 *   VAJRA_SCREENSHOT_ROUTES    space-separated hash routes, e.g. "/ /sale"
 *   VAJRA_SCREENSHOT_VIEWPORT  WxH window content size (default 1366x768)
 *   VAJRA_SCREENSHOT_WAIT      optional data-testid to wait for before snapping
 *   VAJRA_SCREENSHOT_DIR       output folder (default <repo>/screenshots)
 *
 * Output: <dir>/<slug>.png, where "/" → home.png and "/sale?x=1" → sale-x-1.png.
 * Same route overwrites the same file, so the path is predictable for Read().
 */

const routes = (process.env.VAJRA_SCREENSHOT_ROUTES ?? '/').split(/\s+/).filter(Boolean)
const outDir = path.resolve(
  process.env.VAJRA_SCREENSHOT_DIR ?? path.join(__dirname, '../../screenshots')
)
const [viewportWidth, viewportHeight] = parseViewport(process.env.VAJRA_SCREENSHOT_VIEWPORT)
const waitForTestId = process.env.VAJRA_SCREENSHOT_WAIT

for (const route of routes) {
  test(`screenshot ${route}`, async ({ electronApp, page }) => {
    // Shop laptops are ~1366x768. The app opens maximized, which under Xvfb means
    // the framebuffer size; pin the content size so output is stable everywhere.
    await electronApp.evaluate(
      ({ BrowserWindow }, [w, h]) => {
        const win = BrowserWindow.getAllWindows()[0]
        win?.unmaximize()
        win?.setContentSize(w, h)
      },
      [viewportWidth, viewportHeight] as const
    )

    // Home is the fixture's known-good boot signal; every route starts from it.
    await expect(page.getByTestId('home-page')).toBeVisible()
    await page.evaluate((r) => {
      window.location.hash = r
    }, route)

    // Fail fast on a bad route rather than burning the whole test timeout.
    // vue-router resolves a lazy chunk *before* swapping RouterView, so once Home
    // detaches the new view is mounted in the same tick (or nothing is, for an
    // unmatched path). Give the view root a short grace after that, then explain.
    const isHome = /^\/(\?.*)?$/.test(route)
    if (!isHome) {
      await expect(page.getByTestId('home-page'), `leaving Home for ${route}`).toHaveCount(0, {
        timeout: 15_000
      })
    }
    const target = waitForTestId
      ? page.getByTestId(waitForTestId)
      : page.locator('[data-testid$="-page"]').first()
    try {
      await expect(target).toBeVisible({ timeout: 3_000 })
    } catch {
      throw new Error(await explainMissingViewRoot(page, route))
    }
    await page.evaluate(() => document.fonts.ready)

    fs.mkdirSync(outDir, { recursive: true })
    const file = path.join(outDir, `${slugify(route)}.png`)
    await page.screenshot({ path: file, fullPage: true })
    process.stdout.write(`screenshot: ${file}\n`)
  })
}

/** Build the failure message for a route whose view root never showed up. */
async function explainMissingViewRoot(page: Page, route: string): Promise<string> {
  const { hash, text, testIds } = await page.evaluate(() => ({
    hash: window.location.hash,
    // App.vue mounts RouterView inside <main>; an unmatched path leaves it empty.
    text: document.querySelector('main')?.innerText.trim() ?? '',
    testIds: Array.from(document.querySelectorAll('[data-testid]'), (el) =>
      el.getAttribute('data-testid')
    )
  }))
  const wanted = waitForTestId
    ? `data-testid="${waitForTestId}" (VAJRA_SCREENSHOT_WAIT)`
    : 'a data-testid ending in "-page"'
  const lines = [`screenshot ${route}: ${wanted} did not appear within 3s (hash is "${hash}").`]
  if (!text) {
    lines.push(
      'Nothing rendered: the route probably does not exist. Check src/renderer/src/router.ts.'
    )
  } else {
    lines.push(
      'The route rendered but has no view root. Add data-testid="<name>-page" to its root,',
      'or pass VAJRA_SCREENSHOT_WAIT=<testid> for one of the testids present:',
      `  ${[...new Set(testIds)].slice(0, 20).join(', ') || '(none)'}`
    )
  }
  return lines.join('\n')
}

function slugify(route: string): string {
  const slug = route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'home'
}

function parseViewport(raw: string | undefined): [number, number] {
  const m = /^(\d+)x(\d+)$/.exec(raw ?? '')
  if (!m) return [1366, 768]
  return [Number(m[1]), Number(m[2])]
}

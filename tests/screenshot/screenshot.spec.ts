import path from 'node:path'
import fs from 'node:fs'
import { test, expect } from '../smoke/fixtures'

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

    // Route views are lazy chunks: wait for the view root (`*-page` testid) or the
    // caller's explicit testid, then let web fonts (Noto Telugu) finish loading.
    const target = waitForTestId
      ? page.getByTestId(waitForTestId)
      : page.locator('[data-testid$="-page"]').first()
    await expect(target).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    fs.mkdirSync(outDir, { recursive: true })
    const file = path.join(outDir, `${slugify(route)}.png`)
    await page.screenshot({ path: file, fullPage: true })
    process.stdout.write(`screenshot: ${file}\n`)
  })
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

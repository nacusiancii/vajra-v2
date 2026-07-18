/**
 * PROTOTYPE ONLY / OPT-IN — screenshots for #115 Credit Sale finish (C-iteration).
 *
 * Run:
 *   PROTOTYPE_SCREENSHOTS=1 pnpm test:smoke:headless -- tests/smoke/prototype-credit-finish-screenshots.spec.ts
 *
 * Not part of default CI smoke. Safe to delete with the prototype.
 */
import path from 'node:path'
import fs from 'node:fs'
import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const ENABLED = process.env.PROTOTYPE_SCREENSHOTS === '1'
const OUT_DIR = path.join(__dirname, '../../prototype-credit-finish/screenshots')

test.describe('prototype credit-finish screenshots (#115 C-iteration)', () => {
  test.skip(!ENABLED, 'Set PROTOTYPE_SCREENSHOTS=1 to capture PNGs')

  test('capture C1/C2/C3 + invoice-off states', async ({ page }) => {
    test.setTimeout(120_000)
    fs.mkdirSync(OUT_DIR, { recursive: true })

    // Default state: invoice OFF (optional default)
    await captureVariant(page, 'C1', 'C1-checkbox-2x-tag.png', 'prototype-variant-c1')
    await captureVariant(page, 'C2', 'C2-segmented-no-1-2.png', 'prototype-variant-c2')
    await captureVariant(page, 'C3', 'C3-voucher-first-chip.png', 'prototype-variant-c3')

    // C1 with invoice ON + 2x pressed (opt-out still on)
    await page.evaluate(() => {
      window.location.hash = '#/prototype/credit-finish?variant=C1'
    })
    await expect(page.getByTestId('prototype-variant-c1')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(300)
    await page.getByTestId('prototype-print-invoice').click()
    await page.waitForTimeout(200)
    await page
      .getByTestId('prototype-variant-c1')
      .screenshot({ path: path.join(OUT_DIR, 'C1-invoice-on-2x.png') })

    // C1 invoice checked, 2x tag unselected (1 copy)
    await page.getByTestId('prototype-invoice-copies-tag').click()
    await page.waitForTimeout(200)
    await page
      .getByTestId('prototype-variant-c1')
      .screenshot({ path: path.join(OUT_DIR, 'C1-invoice-on-1x.png') })

    // C2 already defaults to "No invoice" — layout reflow shot is the main C2 PNG.
    // Also capture C2 with 2 copies selected for comparison.
    await page.evaluate(() => {
      window.location.hash = '#/prototype/credit-finish?variant=C2'
    })
    await expect(page.getByTestId('prototype-variant-c2')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(300)
    await page.getByTestId('prototype-invoice-seg-2').click()
    await page.waitForTimeout(200)
    await page
      .getByTestId('prototype-variant-c2')
      .screenshot({ path: path.join(OUT_DIR, 'C2-invoice-2-copies.png') })

    // C3 with invoice chip opened + stepper
    await page.evaluate(() => {
      window.location.hash = '#/prototype/credit-finish?variant=C3'
    })
    await expect(page.getByTestId('prototype-variant-c3')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(300)
    await page.getByTestId('prototype-add-invoice-chip').click()
    await page.waitForTimeout(200)
    await page
      .getByTestId('prototype-variant-c3')
      .screenshot({ path: path.join(OUT_DIR, 'C3-invoice-chip-on.png') })
  })
})

async function captureVariant(
  page: Page,
  key: string,
  filename: string,
  testId: string
): Promise<void> {
  await page.evaluate((variant) => {
    window.location.hash = `#/prototype/credit-finish?variant=${variant}`
  }, key)
  await expect(page.getByTestId('prototype-credit-finish-page')).toBeVisible({ timeout: 15_000 })
  const dialog = page.getByTestId(testId)
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  // Wait a beat for dialog open animation
  await page.waitForTimeout(400)
  await dialog.screenshot({ path: path.join(OUT_DIR, filename) })
}

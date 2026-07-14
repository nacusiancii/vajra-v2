/**
 * PROTOTYPE ONLY / OPT-IN — screenshots for #115 dual-panel Credit Sale finish.
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

test.describe('prototype credit-finish screenshots (#115)', () => {
  test.skip(!ENABLED, 'Set PROTOTYPE_SCREENSHOTS=1 to capture PNGs')

  test('capture before + variants A/B/C', async ({ page }) => {
    test.setTimeout(180_000)
    fs.mkdirSync(OUT_DIR, { recursive: true })

    // ── 00-before: today's single-panel Credit Sale finish (real path) ──
    await seedCreditFinishPath(page)
    await expect(page.getByTestId('slip-preview')).toBeVisible()
    await page.getByTestId('slip-preview').screenshot({
      path: path.join(OUT_DIR, '00-before.png')
    })
    await page.getByTestId('slip-done').click()
    await expect(page.getByTestId('home-page')).toBeVisible()

    // ── Variants: throwaway prototype route (mock data) ──
    await captureVariant(page, 'A', 'A-side-by-side.png', 'prototype-variant-a')
    await captureVariant(page, 'B', 'B-stacked-tabs.png', 'prototype-variant-b')
    await captureVariant(page, 'C', 'C-master-detail.png', 'prototype-variant-c')
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

/** Mirror credit-voucher.spec.ts path through finish slip preview. */
async function seedCreditFinishPath(page: Page): Promise<void> {
  await page.getByRole('link', { name: /Settings/ }).click()
  await page.getByTestId('company-name-input').fill('Sri Venkateswara Traders')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await page.getByRole('link', { name: /^Vajra$/ }).click()

  await page.getByTestId('management-links').getByText('Product Master').click()
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill('Toor Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await page.getByRole('link', { name: /^Vajra$/ }).click()

  await page.getByTestId('management-links').getByText('Customer Master').click()
  await page.getByTestId('add-customer-btn').click()
  await page.getByTestId('customer-name-input').fill('Ravi Kumar')
  await page.getByTestId('customer-place-combobox').fill('Guntur')
  await page.getByTestId('customer-phone-input').fill('9876543210')
  await page.getByTestId('customer-submit').click()
  await page.getByRole('link', { name: /^Vajra$/ }).click()

  await page.getByTestId('open-sale').click()
  await page.getByTestId('sale-gate-credit').click()
  await page.getByPlaceholder(/Type a customer name/).fill('Ravi')
  await page.getByRole('option', { name: /Ravi Kumar/ }).click()

  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByRole('option', { name: 'Toor Dal' })).toBeVisible()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('voucher-gate')).toBeVisible()
  await page.getByTestId('voucher-gate-print').click()
  await expect(page.getByTestId('voucher-preview')).toBeVisible()
  await page.getByTestId('voucher-preview-done').click()

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
}

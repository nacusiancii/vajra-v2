import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * High-value cashier keyboard path (issue #168):
 * Home digit 1 opens Cash Sale; Tab (not Enter-to-next) through the cart;
 * Escape on the committed slip returns Home.
 */

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function seedBulkProduct(page: Page): Promise<void> {
  await page.getByTestId('management-links').getByText('Product Master').click()
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill('Toor Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

test('keyboard: Home 1 starts Cash Sale, add line, Escape on slip goes Home', async ({ page }) => {
  test.setTimeout(60_000)
  await seedBulkProduct(page)

  await expect(page.getByTestId('home-page')).toBeVisible()
  await page.keyboard.press('1')

  await expect(page.getByTestId('sale-page')).toHaveAttribute('data-mode', 'cash')
  await expect(page.getByTestId('sale-counterparty-mode')).toContainText('Walk in')
  await expect(page.getByTestId('sale-walkin-name')).toBeFocused()

  // Name → Place → Phone → Product trigger. Enter opens the picker (not auto-open).
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('cart-product')).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByPlaceholder(/Type a product name/i)).toBeVisible()
  await page.keyboard.type('Toor Dal')
  await expect(page.getByRole('option', { name: 'Toor Dal' })).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('cart-qty')).toBeFocused()
  await page.keyboard.type('1')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('cart-rate')).toBeFocused()
  await page.keyboard.type('2000')

  // Click Finish — do not Tab the settle cluster; NumericField Enter must not reach it.
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('home-page')).toBeVisible()
  await expect(page.getByTestId('home-txn-row')).toBeVisible()
  await expect(page.getByTestId('home-txn-row')).toContainText('Sale')
  await expect(page.getByTestId('sale-page')).not.toBeVisible()
})

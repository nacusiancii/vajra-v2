import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * One narrative that exercises the whole transactional core end-to-end:
 * catalog a Bulk product, buy stock, sell some, watch the Inventory projection move,
 * then Rollover and confirm the closing stock becomes the next day's Opening Stock.
 */

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

/** Open a management card by its heading (the card's accessible name starts with it). */
async function openManagement(page: Page, name: string): Promise<void> {
  await page
    .getByTestId('management-links')
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .click()
}

async function addToorDal(page: Page): Promise<void> {
  await page.getByTestId('management-links').getByText('Product Master').click()
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill('Toor Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
}

test('catalog → purchase → sale → inventory → rollover', async ({ page }) => {
  await addToorDal(page)
  await goHome(page)

  // ── Purchase 10 bags @ ₹6000/quintal (500kg = 5 quintal = ₹30,000) ──
  await page.getByRole('link', { name: /New Purchase/i }).click()
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('10')
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await expect(page.getByTestId('txn-row')).toHaveCount(1)

  // Inventory now shows 10 bags.
  await goHome(page)
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('Toor Dal')
  await expect(page.getByTestId('inventory-row')).toContainText('10')

  // ── Sale: 2 bags cash to a walk-in (100kg = 1 quintal = ₹6000) ──
  await goHome(page)
  await page.getByRole('link', { name: /New Sale/i }).click()
  await page.getByTestId('sale-counterparty-mode').click()
  await page.getByRole('option', { name: 'Walk-in' }).click()
  await page.getByTestId('sale-walkin-name').fill('Counter Customer')
  await page.getByTestId('sale-walkin-place').fill('Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')
  await expect(page.getByTestId('sale-total')).toContainText('6,000')
  await page.getByTestId('sale-cash').fill('6000')
  await page.getByTestId('sale-finish').click()

  // Slip preview shows the would-be Sale Invoice with a Sale Number.
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('sale-number')).toHaveText('1')
  await page.getByTestId('slip-done').click()

  // Ledger has both transactions; drawer reflects the ₹6,000 cash sale.
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await expect(page.getByTestId('txn-row')).toHaveCount(2)
  await expect(page.getByTestId('drawer-summary')).toContainText('6,000')

  // Inventory projection: 10 − 2 = 8.
  await goHome(page)
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('8')

  // ── Rollover: closing 8 becomes the next day's Opening Stock ──
  await goHome(page)
  await openManagement(page, 'Rollover')
  await page.getByTestId('rollover-approve-open').click()
  await page.getByTestId('rollover-approve-confirm').click()
  await expect(page.getByTestId('home-page')).toBeVisible()

  // New day: ledger empty, Opening Stock = 8.
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('8')
  await goHome(page)
  await openManagement(page, 'Transactions')
  await expect(page.getByText('No transactions yet today.')).toBeVisible()
})

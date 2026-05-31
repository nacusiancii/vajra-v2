import { test, expect } from './fixtures'
import type { ElectronApplication, Page } from '@playwright/test'

/**
 * One narrative that exercises the whole transactional core end-to-end:
 * catalog a Bulk product, buy stock, sell some, watch the Inventory projection move,
 * then Rollover and confirm the closing stock becomes the next day's Opening Stock.
 *
 * Transactions now run in their own OS windows, so the flow opens a window per
 * transaction, finishes it (the window self-closes), and reads results back in the
 * hub — whose queries refetch when each records view is navigated to.
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

/** Click a hub action that spawns a transaction window and return that window. */
async function openTxnWindow(app: ElectronApplication, page: Page, testId: string): Promise<Page> {
  const [win] = await Promise.all([app.waitForEvent('window'), page.getByTestId(testId).click()])
  await win.waitForLoadState('domcontentloaded')
  return win
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

test('catalog → purchase → sale → inventory → rollover', async ({ electronApp, page }) => {
  // Each transaction now opens and closes its own OS window, so this end-to-end
  // narrative needs more than the default 30s budget.
  test.setTimeout(90_000)

  await addToorDal(page)
  await goHome(page)

  // ── Purchase 10 bags @ ₹6000/quintal on credit (stock-in, no drawer impact) ──
  const purchase = await openTxnWindow(electronApp, page, 'open-purchase')
  await purchase.keyboard.press('Escape') // dismiss the auto-opened supplier picker
  await purchase.getByTestId('cart-add-line').click()
  await purchase.getByTestId('cart-product').click()
  await purchase.getByRole('option', { name: 'Toor Dal' }).click()
  await purchase.getByTestId('cart-rate').fill('6000')
  await purchase.getByTestId('cart-qty').fill('10')
  await purchase.getByTestId('purchase-mode').click()
  await purchase.getByRole('option', { name: 'Credit received' }).click()
  // Register the close listener before the click — the window self-closes async on success.
  await Promise.all([
    purchase.waitForEvent('close'),
    purchase.getByTestId('purchase-finish').click()
  ])

  // Inventory now shows 10 bags (hub refetches on navigation).
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('Toor Dal')
  await expect(page.getByTestId('inventory-row')).toContainText('10')
  await goHome(page)

  // ── Sale: 2 bags cash to a walk-in (100kg = 1 quintal = ₹6000) ──
  const sale = await openTxnWindow(electronApp, page, 'open-sale')
  // Customer mode auto-opens its picker; dismiss it before switching to walk-in.
  await sale.keyboard.press('Escape')
  await sale.getByTestId('sale-counterparty-mode').click()
  await sale.getByRole('option', { name: 'Walk-in' }).click()
  await sale.getByTestId('sale-walkin-name').fill('Counter Customer')
  await sale.getByTestId('sale-walkin-place').fill('Guntur')
  await sale.getByTestId('cart-add-line').click()
  await sale.getByTestId('cart-product').click()
  await sale.getByRole('option', { name: 'Toor Dal' }).click()
  await sale.getByTestId('cart-rate').fill('6000')
  await sale.getByTestId('cart-qty').fill('2')
  await expect(sale.getByTestId('sale-total')).toContainText('6,000')
  // No UPI entered → cash auto-derives to the full ₹6,000.
  await expect(sale.getByTestId('sale-cash')).toHaveValue('6000')
  await sale.getByTestId('sale-finish').click()

  // Slip preview shows the would-be Sale Invoice with a Sale Number.
  await expect(sale.getByTestId('slip-preview')).toBeVisible()
  await expect(sale.getByTestId('sale-number')).toHaveText('1')
  await Promise.all([sale.waitForEvent('close'), sale.getByTestId('slip-done').click()])

  // Ledger has both transactions; drawer reflects the ₹6,000 cash sale.
  await openManagement(page, 'Transactions')
  await expect(page.getByTestId('txn-row')).toHaveCount(2)
  await expect(page.getByTestId('drawer-summary')).toContainText('6,000')
  await goHome(page)

  // Inventory projection: 10 − 2 = 8.
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('8')
  await goHome(page)

  // ── Rollover: closing 8 becomes the next day's Opening Stock ──
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

import { test, expect } from './fixtures'
import type { ElectronApplication, Page } from '@playwright/test'

/**
 * A Credit Sale can't finish until a voucher is printed at the current price for the
 * customer to sign. Each print mints a fresh Voucher Number; the Sale records the one
 * printed at the final price.
 */

async function openTxnWindow(app: ElectronApplication, page: Page, testId: string): Promise<Page> {
  const [win] = await Promise.all([app.waitForEvent('window'), page.getByTestId(testId).click()])
  await win.waitForLoadState('domcontentloaded')
  return win
}

test('credit sale is gated on a printed, signed voucher', async ({ electronApp, page }) => {
  test.setTimeout(60_000)

  // A Bulk product to sell.
  await page.getByTestId('management-links').getByText('Product Master').click()
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill('Toor Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await page.getByRole('link', { name: /^Vajra$/ }).click()

  // A customer with a phone (Credit Sales require one).
  await page.getByTestId('management-links').getByText('Customer Master').click()
  await page.getByTestId('add-customer-btn').click()
  await page.getByTestId('customer-name-input').fill('Ravi Kumar')
  await page.getByTestId('customer-place-combobox').fill('Guntur')
  await page.getByTestId('customer-phone-input').fill('9876543210')
  await page.getByTestId('customer-submit').click()
  await page.getByRole('link', { name: /^Vajra$/ }).click()

  // ── Credit Sale ──
  const sale = await openTxnWindow(electronApp, page, 'open-sale')
  // Customer mode auto-opens its picker — type into the filter, then pick the match.
  await sale.getByPlaceholder(/Type a customer name/).fill('Ravi')
  await sale.getByRole('option', { name: /Ravi Kumar/ }).click()

  await sale.getByTestId('cart-add-line').click()
  await sale.getByTestId('cart-product').click()
  await sale.getByRole('option', { name: 'Toor Dal' }).click()
  await sale.getByTestId('cart-rate').fill('6000')
  await sale.getByTestId('cart-qty').fill('2')

  await sale.getByTestId('sale-mode').click()
  await sale.getByRole('option', { name: 'Credit' }).click()

  // Finishing without a printed voucher is blocked by the gate.
  await sale.getByTestId('sale-finish').click()
  await expect(sale.getByTestId('voucher-gate')).toBeVisible()

  // Print mints Voucher #1.
  await sale.getByTestId('voucher-gate-print').click()
  await expect(sale.getByTestId('voucher-preview')).toBeVisible()
  await expect(sale.getByTestId('voucher-number')).toHaveText('1')
  await sale.getByTestId('voucher-preview-done').click()

  // Now the Sale finishes and shows its invoice.
  await sale.getByTestId('sale-finish').click()
  await expect(sale.getByTestId('slip-preview')).toBeVisible()
  await expect(sale.getByTestId('sale-number')).toHaveText('1')
  await Promise.all([sale.waitForEvent('close'), sale.getByTestId('slip-done').click()])

  // The ledger holds the one credit Sale.
  await page
    .getByTestId('management-links')
    .getByRole('link', { name: /^Transactions/ })
    .click()
  await expect(page.getByTestId('txn-row')).toHaveCount(1)
})

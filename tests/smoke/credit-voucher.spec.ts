import { test, expect } from './fixtures'

/**
 * A Credit Sale can't finish until a voucher is printed at the current price for the
 * customer to sign. Each print mints a fresh Voucher Number; the Sale records the one
 * printed at the final price.
 */

test('credit sale is gated on a printed, signed voucher', async ({ page }) => {
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
  await page.getByTestId('open-sale').click()
  // Picking Credit at the gate opens the workspace; the customer picker auto-opens —
  // type into the filter, then pick the match.
  await page.getByTestId('sale-gate-credit').click()
  await page.getByPlaceholder(/Type a customer name/).fill('Ravi')
  await page.getByRole('option', { name: /Ravi Kumar/ }).click()

  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  // The segmented control still flips the mode mid-cart; the settle card follows.
  await page.getByTestId('sale-mode-cash').click()
  await expect(page.getByTestId('sale-upi')).toBeVisible()
  await page.getByTestId('sale-mode-credit').click()
  await expect(page.getByTestId('credit-voucher-controls')).toBeVisible()

  // Finishing without a printed voucher is blocked by the gate.
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('voucher-gate')).toBeVisible()

  // Print mints Voucher #1.
  await page.getByTestId('voucher-gate-print').click()
  await expect(page.getByTestId('voucher-preview')).toBeVisible()
  await expect(page.getByTestId('voucher-number')).toHaveText('1')
  await page.getByTestId('voucher-preview-done').click()

  // Now the Sale finishes and shows its invoice.
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('sale-number')).toHaveText('1')
  await page.getByTestId('slip-done').click()

  // Done lands on the ledger, which holds the one credit Sale.
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await expect(page.getByTestId('txn-row')).toHaveCount(1)
})

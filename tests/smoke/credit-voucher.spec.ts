import { test, expect } from './fixtures'

/**
 * Credit Sale finish prints Sale Invoice + Credit Voucher together.
 * Same transaction ID on both (ADR-0009). Voucher always prints once; invoice
 * Print is on by default and two copies off. No signed-voucher confirmation step.
 */

test('credit sale finish shows invoice and voucher together', async ({ page }) => {
  test.setTimeout(60_000)

  // Company Name appears on the voucher front.
  await page.getByRole('link', { name: /Settings/ }).click()
  await page.getByTestId('company-name-input').fill('Sri Venkateswara Traders')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await page.getByRole('link', { name: /^Vajra$/ }).click()

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
  await page.getByTestId('open-credit-sale').click()
  // Mode is pre-chosen from Home; customer picker auto-opens —
  // type into the filter, then pick the match. Selecting a customer on an empty cart
  // adds the first line and opens the product dropdown.
  await expect(page.getByTestId('sale-page')).toHaveAttribute('data-mode', 'credit')
  await page.getByPlaceholder(/Type a customer name/).fill('Ravi')
  await page.getByRole('option', { name: /Ravi Kumar/ }).click()

  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByRole('option', { name: 'Toor Dal' })).toBeVisible()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  // The segmented control still flips the mode mid-cart; the settle card follows.
  await page.getByTestId('sale-mode-cash').click()
  await expect(page.getByTestId('sale-upi')).toBeVisible()
  await page.getByTestId('sale-mode-credit').click()
  await expect(page.getByTestId('credit-settle-hint')).toBeVisible()
  // No pre-finish voucher gate / print button.
  await expect(page.getByTestId('credit-voucher-controls')).toHaveCount(0)
  await expect(page.getByTestId('print-voucher')).toHaveCount(0)

  // Finish commits immediately and opens the unified finish panel.
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('credit-finish-panel')).toBeVisible()

  // Defaults: Print invoice checked, two copies unchecked.
  await expect(page.getByTestId('credit-finish-print-invoice')).toHaveAttribute(
    'data-state',
    'checked'
  )
  await expect(page.getByTestId('credit-finish-two-copies')).toHaveAttribute(
    'data-state',
    'unchecked'
  )
  await expect(page.getByTestId('slip-copy-count')).toHaveText('1× print')
  await expect(page.getByTestId('credit-finish-voucher-will-print')).toBeVisible()

  // Invoice and voucher share one transaction ID.
  await expect(page.getByTestId('sale-number')).toHaveText(/^SA-R-\d+-\d{8}$/)
  const txnId = await page.getByTestId('sale-number').innerText()
  await expect(page.getByTestId('voucher-number')).toHaveText(txnId)
  await expect(page.getByTestId('slip-voucher-id')).toHaveText(txnId)
  await expect(page.getByTestId('credit-finish-sale-id')).toHaveText(txnId)
  await expect(page.getByTestId('credit-finish-voucher-id')).toHaveText(txnId)

  // Invoice face.
  await expect(page.getByTestId('sale-invoice')).toBeVisible()
  await expect(page.getByTestId('slip-customer')).toHaveText('Ravi Kumar')
  await expect(page.getByTestId('slip-place')).toHaveText('Guntur')
  await expect(page.getByTestId('slip-phone')).toHaveText('9876543210')

  // Voucher front: company, date, place, mobile, customer, amount.
  await expect(page.getByTestId('voucher-front')).toBeVisible()
  await expect(page.getByTestId('voucher-company')).toHaveText('Sri Venkateswara Traders')
  await expect(page.getByTestId('voucher-place')).toHaveText('Guntur')
  await expect(page.getByTestId('voucher-phone')).toHaveText('9876543210')
  await expect(page.getByTestId('voucher-customer')).toHaveText('Ravi Kumar')
  await expect(page.getByTestId('voucher-date')).not.toHaveText('—')
  await expect(page.getByTestId('voucher-amount')).toContainText('6,000')

  // Back is collapsible on the finish panel — expand and check lines.
  await page.getByTestId('voucher-show-back').click()
  await expect(page.getByTestId('voucher-back')).toBeVisible()
  const line = page.getByTestId('voucher-line')
  await expect(line).toHaveCount(1)
  await expect(line).toContainText('Toor Dal')
  await expect(line).toContainText('2 × 0.5 ×')
  await expect(page.getByTestId('voucher-total')).toContainText('6,000')

  // Toggle two copies → 2×; uncheck print → not printing (voucher still will print).
  await page.getByTestId('credit-finish-two-copies').click()
  await expect(page.getByTestId('slip-copy-count')).toHaveText('2× print')
  await page.getByTestId('credit-finish-print-invoice').click()
  await expect(page.getByTestId('credit-finish-invoice-not-printing')).toBeVisible()
  await expect(page.getByTestId('credit-finish-voucher-will-print')).toBeVisible()

  await page.getByTestId('credit-finish-done').click()

  // Done returns Home; open ledger for the one credit Sale.
  await expect(page.getByTestId('home-page')).toBeVisible()
  await page
    .getByTestId('management-links')
    .getByRole('link', { name: /^Transactions/ })
    .click()
  await expect(page.getByTestId('txn-row')).toHaveCount(1)
})

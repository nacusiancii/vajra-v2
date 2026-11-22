import fs from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { goHome, seedCustomer, seedProduct } from './helpers'

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
  await page.getByTestId('upi-id-input').fill('svtraders@ybl')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await goHome(page)

  // A Bulk product to sell.
  await seedProduct(page, { name: 'Toor Dal' })

  // A customer with a phone (Credit Sales require one).
  await seedCustomer(page, { name: 'Ravi Kumar', place: 'Guntur', phone: '9876543210' })

  // ── Credit Sale ──
  await page.getByTestId('open-credit-sale').click()
  // Mode is pre-chosen from Home; customer picker auto-opens —
  // type into the filter, then pick the match. Cart already has one blank row;
  // Customer Master pick focuses the product picker when that row is still empty.
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
  await expect(page.getByTestId('voucher-words')).toHaveText('Six Thousand Rupees only')
  await expect(page.getByTestId('voucher-interest')).toContainText('రూ. 2-00')
  await expect(page.getByTestId('voucher-qr')).toBeVisible()

  // Back is collapsible on the finish panel — expand and check lines.
  await page.getByTestId('voucher-show-back').click()
  await expect(page.getByTestId('voucher-back')).toBeVisible()
  const line = page.getByTestId('voucher-line')
  await expect(line).toHaveCount(1)
  await expect(line).toContainText('Toor Dal')
  await expect(line).toContainText('2 × 0.5 ×')
  await expect(page.getByTestId('voucher-total')).toContainText('6,000')

  // ADR-0012: Save PDF writes the voucher as one duplex sheet (front + back) and
  // the Quotation (Print on, one copy) as its own file.
  await page.getByTestId('credit-finish-save-pdf').click()
  const results = page.getByTestId('credit-finish-pdf-result')
  await expect(results).toHaveCount(2)
  await expect(results.nth(0)).toContainText(`${txnId}_voucher.pdf`)
  await expect(results.nth(1)).toContainText(`${txnId}_quotation.pdf`)
  expect(await pdfPageCount(page, 0)).toBe(2)
  expect(await pdfPageCount(page, 1)).toBe(1)

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

/** Page count of the PDF named in the nth "Saved …" line on the credit finish panel. */
async function pdfPageCount(page: Page, nth: number): Promise<number> {
  const text = await page.getByTestId('credit-finish-pdf-result').nth(nth).textContent()
  const pdfPath = (text ?? '').replace(/^\s*Saved\s*/, '').trim()
  const pdf = fs.readFileSync(pdfPath, 'latin1')
  expect(pdf.startsWith('%PDF')).toBe(true)
  return pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0
}

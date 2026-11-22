import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import jsQR from 'jsqr'
import { test, expect } from './fixtures'
import { goHome, seedCustomer, seedProduct } from './helpers'

/**
 * Credit Sale finish shows the Credit Voucher; "Print & finish" saves it as a
 * two-page PDF (front, back) plus the Quotation per the Settings default
 * (ADR-0012). Same transaction ID on both (ADR-0009).
 */

test('credit sale finish shows the voucher and prints it with the Quotation', async ({
  page,
  electronApp
}) => {
  test.setTimeout(60_000)

  // Company Name appears on the voucher front.
  await page.getByRole('link', { name: /Settings/ }).click()
  await page.getByTestId('company-name-input').fill('Sri Venkateswara Traders')
  await page.getByTestId('upi-id-input').fill('svtraders@ybl')
  // Credit Sale default: two Quotation copies (Print Quotation is on out of the box).
  await expect(page.getByTestId('credit-print-quotation-default')).toHaveAttribute(
    'data-state',
    'checked'
  )
  await page.getByTestId('credit-two-copies-default').click()
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
  await expect(page.getByTestId('sale-upi')).toHaveCount(0)
  // No pre-finish voucher gate / print button.
  await expect(page.getByTestId('credit-voucher-controls')).toHaveCount(0)
  await expect(page.getByTestId('print-voucher')).toHaveCount(0)

  // Finish commits immediately and opens the finish panel.
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('credit-finish-panel')).toBeVisible()

  // Print queue starts from the Settings default: Quotation on, two copies.
  await expect(page.getByTestId('credit-finish-print-invoice')).toHaveAttribute(
    'data-state',
    'checked'
  )
  await expect(page.getByTestId('credit-finish-two-copies')).toHaveAttribute(
    'data-state',
    'checked'
  )
  await expect(page.getByTestId('slip-copy-count')).toHaveText(
    'Prints: voucher + Quotation (2 copies)'
  )
  // The panel shows the voucher, not a Quotation preview.
  await expect(page.getByTestId('sale-invoice')).toHaveCount(0)

  await expect(page.getByTestId('credit-finish-sale-id')).toHaveText(/^SA-R-\d+-\d{8}$/)
  const txnId = await page.getByTestId('credit-finish-sale-id').innerText()
  await expect(page.getByTestId('voucher-number')).toHaveText(txnId)

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
  await expect(page.getByTestId('voucher-qr-caption')).toContainText('svtraders@ybl')
  // The QR scans to the shop's UPI ID with no amount (CONTEXT.md, Credit Voucher).
  expect(await decodeVoucherQr(page)).toBe(
    'upi://pay?pa=svtraders@ybl&pn=Sri%20Venkateswara%20Traders&cu=INR'
  )

  // Back is collapsible on the finish panel — expand and check lines.
  await page.getByTestId('voucher-show-back').click()
  await expect(page.getByTestId('voucher-back')).toBeVisible()
  const line = page.getByTestId('voucher-line')
  await expect(line).toHaveCount(1)
  await expect(line).toContainText('Toor Dal')
  await expect(line).toContainText('2 × 0.5 ×')
  await expect(page.getByTestId('voucher-total')).toContainText('6,000')

  // ADR-0012: Print & finish saves the voucher as one duplex sheet (front + back)
  // and the Quotation (two copies, from Settings) as its own file.
  await expect(page.getByTestId('credit-finish-done')).toHaveText('Print & finish')
  await page.getByTestId('credit-finish-done').click()
  await expect(page.getByTestId('toast')).toContainText('Saved 2 PDFs to')
  const printDir = (await electronApp.evaluate(() => process.env.VAJRA_PRINT_DIR)) as string
  expect(pdfPageCount(path.join(printDir, `${txnId}_voucher.pdf`))).toBe(2)
  expect(pdfPageCount(path.join(printDir, `${txnId}_quotation.pdf`))).toBe(2)

  // Done returns Home; open ledger for the one credit Sale.
  await expect(page.getByTestId('home-page')).toBeVisible()
  await page
    .getByTestId('management-links')
    .getByRole('link', { name: /^Transactions/ })
    .click()
  await expect(page.getByTestId('txn-row')).toHaveCount(1)
})

/** Page count of a saved PDF. */
function pdfPageCount(pdfPath: string): number {
  const pdf = fs.readFileSync(pdfPath, 'latin1')
  expect(pdf.startsWith('%PDF')).toBe(true)
  return pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0
}

/**
 * Decode the voucher QR as drawn: read the SVG's module squares (`Mx yh1v1h-1z`),
 * paint them 8 px each into an RGBA buffer, and scan it with jsQR. Decoding the
 * drawn path, not a screenshot, keeps it independent of preview zoom.
 */
async function decodeVoucherQr(page: Page): Promise<string | null> {
  const svg = page.getByTestId('voucher-qr').first()
  const viewBox = (await svg.getAttribute('viewBox')) ?? ''
  const d = (await svg.locator('path').getAttribute('d')) ?? ''
  const [, , w] = viewBox.split(' ').map(Number) // "-2 -2 size+4 size+4"
  const px = 8
  const side = w * px
  const rgba = new Uint8ClampedArray(side * side * 4).fill(255)
  for (const [, x, y] of d.matchAll(/M(\d+) (\d+)/g)) {
    const ox = (Number(x) + 2) * px
    const oy = (Number(y) + 2) * px
    for (let dy = 0; dy < px; dy++) {
      for (let dx = 0; dx < px; dx++) {
        const i = ((oy + dy) * side + ox + dx) * 4
        rgba[i] = rgba[i + 1] = rgba[i + 2] = 0
      }
    }
  }
  return jsQR(rgba, side, side)?.data ?? null
}

test('a failed PDF save lets the cashier continue without it', async ({ page, electronApp }) => {
  test.setTimeout(60_000)
  // A plain file where the prints folder should be makes every save fail.
  const printDir = (await electronApp.evaluate(() => process.env.VAJRA_PRINT_DIR)) as string
  fs.mkdirSync(path.dirname(printDir), { recursive: true })
  fs.writeFileSync(printDir, 'not a folder')

  await seedProduct(page, { name: 'Toor Dal' })
  await page.getByTestId('open-cash-sale').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('1')
  await page.getByTestId('sale-finish').click()

  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('slip-pdf-error')).toContainText('Could not save PDF')
  await expect(page.getByTestId('slip-done')).toHaveText('Continue without PDF')
  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
})

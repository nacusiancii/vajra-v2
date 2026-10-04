import { test, expect } from './fixtures'
import { dismissAutoPicker, openManagement, seedCustomer } from './helpers'

/**
 * Receipt settlement model: cashier enters Cash, UPI, and discount ₹.
 * Covers create (with discount) and edit round-trip of the discount amount.
 */

test('receipt cash + UPI + discount stores and edits round-trip', async ({ page }) => {
  test.setTimeout(60_000)

  await seedCustomer(page, { name: 'Lakshmi Traders', place: 'Guntur' })

  // ── Create Receipt: ₹700 cash + ₹200 UPI + ₹100 discount ──
  await page.getByTestId('secondary-actions').getByRole('link', { name: 'Receipt' }).click()
  await expect(page.getByTestId('money-page')).toBeVisible()
  await dismissAutoPicker(page)

  await page.getByTestId('money-customer').click()
  await page.getByRole('option', { name: 'Lakshmi Traders' }).click()

  await page.getByTestId('money-cash').fill('700')
  await page.getByTestId('money-upi').fill('200')
  await page.getByTestId('money-discount').fill('100')
  // Realized cash+UPI, then face (realized + less) as the total.
  await expect(page.getByTestId('money-summary')).toContainText('Received')
  await expect(page.getByTestId('money-summary')).toContainText('900')
  await expect(page.getByTestId('money-summary')).toContainText('Total Incl. less')
  await expect(page.getByTestId('money-summary')).toContainText('1,000')

  await page.getByTestId('money-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
  // Home recent list shows realized total (cash+UPI), not face.
  await expect(page.getByTestId('recent-transactions')).toContainText('Receipt')
  await expect(page.getByTestId('recent-transactions')).toContainText('900')

  // ── Edit: discount must load (not reset to 0) and re-save ──
  await openManagement(page, 'Transactions')
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await page.getByTestId('txn-edit').click()
  await expect(page.getByTestId('money-page')).toBeVisible()
  await expect(page.getByTestId('money-cash')).toHaveValue('700')
  await expect(page.getByTestId('money-upi')).toHaveValue('200')
  await expect(page.getByTestId('money-discount')).toHaveValue('100')

  await page.getByTestId('money-discount').fill('150')
  await page.getByTestId('money-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()

  // Re-open edit to confirm the new discount stuck (void + successor).
  await openManagement(page, 'Transactions')
  await page.getByTestId('txn-edit').first().click()
  await expect(page.getByTestId('money-page')).toBeVisible()
  await expect(page.getByTestId('money-cash')).toHaveValue('700')
  await expect(page.getByTestId('money-upi')).toHaveValue('200')
  await expect(page.getByTestId('money-discount')).toHaveValue('150')
})

test('receipt rejects all-zero entry', async ({ page }) => {
  await seedCustomer(page, { name: 'Zero Check', place: 'Tenali' })

  await page.getByTestId('secondary-actions').getByRole('link', { name: 'Receipt' }).click()
  await dismissAutoPicker(page)
  await page.getByTestId('money-customer').click()
  await page.getByRole('option', { name: 'Zero Check' }).click()

  // Leave cash / UPI / discount empty and try to finish.
  await page.getByTestId('money-finish').click()
  await expect(page.getByTestId('money-error')).toBeVisible()
  await expect(page.getByTestId('money-error')).toContainText(/cash, UPI, or a discount/i)
  await expect(page.getByTestId('money-page')).toBeVisible()
})

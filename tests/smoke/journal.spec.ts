import { test, expect } from './fixtures'

test('Journal capture appears on Home Recent and Transactions without a credit badge', async ({
  page
}) => {
  await page.getByTestId('secondary-actions').getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByTestId('journal-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'New Journal' })).toBeVisible()

  await page.getByTestId('journal-finish').click()
  await expect(page.getByTestId('journal-error')).toContainText('Journal needs a Party')

  await page.getByTestId('journal-party').fill('Ravi')
  await page.getByTestId('journal-finish').click()
  await expect(page.getByTestId('journal-error')).toContainText('Amount must be greater than zero')

  await page.getByTestId('journal-amount').fill('25')
  await page.getByTestId('journal-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()

  const recent = page.getByTestId('recent-transactions')
  const row = recent.getByTestId('home-txn-row').first()
  await expect(row).toContainText('Journal Debit')
  await expect(row).toContainText('Ravi')
  await expect(row).toContainText('25')
  await expect(row.getByText('credit', { exact: true })).toHaveCount(0)

  await row.getByTestId('txn-edit').click()
  await expect(page.getByTestId('journal-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Edit Journal' })).toBeVisible()
  await expect(page.getByTestId('journal-party')).toHaveValue('Ravi')
  await expect(page.getByTestId('journal-amount')).toHaveValue('25')
  await expect(page.getByTestId('journal-side-debit')).toHaveClass(/bg-primary/)

  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
  await page.getByRole('link', { name: /See all/ }).click()
  await expect(page.getByTestId('transactions-page')).toBeVisible()

  const txnRow = page.getByTestId('txn-row').first()
  await expect(txnRow).toContainText('Journal Debit')
  await expect(txnRow).toContainText('Ravi')
  // Drawer cell uses formatRupees(0) — today ₹0.00 — proving ZERO_DRAWER persisted.
  await expect(txnRow).toContainText('₹0.00')
  await expect(txnRow.getByText('credit', { exact: true })).toHaveCount(0)
})

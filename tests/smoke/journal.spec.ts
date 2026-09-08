import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Journal is a day-scoped side-record: enter via hash (no Home button in this PR),
 * list on Transactions & Records, void-chain Edit / cancel, wipe at Rollover.
 * Isolation: drawer, inventory, and ledger_generation must not move.
 */

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function openManagement(page: Page, name: string): Promise<void> {
  await page
    .getByTestId('management-links')
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .click()
}

async function openJournal(page: Page): Promise<void> {
  await page.evaluate(() => {
    location.hash = '/journal'
  })
  await expect(page.getByTestId('journal-page')).toBeVisible()
}

async function recordJournal(page: Page, party: string, amount: string): Promise<void> {
  await openJournal(page)
  await page.getByTestId('journal-debit-name').fill(party)
  await page.getByTestId('journal-debit-amount').fill(amount)
  await page.getByTestId('journal-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

test('records a Journal on Transactions & Records without touching the ledger', async ({
  page
}) => {
  await expect(page.getByTestId('home-page')).toBeVisible()
  await recordJournal(page, 'Ravi', '100')

  await openManagement(page, 'Transactions')
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Transactions & Records' })).toBeVisible()
  await expect(page.getByText('No entries yet today.')).toHaveCount(0)
  await expect(page.getByTestId('journal-row')).toHaveCount(1)
  await expect(page.getByTestId('txn-row')).toHaveCount(0)

  const row = page.getByTestId('journal-row')
  await expect(row).toContainText('J-1')
  await expect(row).toContainText('Journal')
  await expect(row).toContainText('Ravi')
  await expect(row).toContainText('Dr')
  await expect(row).toContainText('₹100.00')
  await expect(row).toContainText('—')
  await expect(row.getByText('₹0.00')).toHaveCount(0)
  await expect(row.getByTestId('journal-edit')).toBeVisible()
  await expect(row.getByTestId('journal-delete')).toBeVisible()

  const drawer = page.getByTestId('drawer-summary')
  await expect(drawer).toContainText('₹0.00')
  await expect(drawer).not.toContainText('₹100.00')

  await goHome(page)
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-page')).toBeVisible()
  await expect(page.getByText('No products in the catalog yet.')).toBeVisible()
  await expect(page.getByTestId('inventory-row')).toHaveCount(0)
})

test('Journal writes leave Approve enabled; void-chain is live-tip only', async ({ page }) => {
  test.setTimeout(60_000)

  await openManagement(page, 'Rollover')
  await expect(page.getByTestId('rollover-page')).toBeVisible()
  await page.getByTestId('eod-export').click()
  await expect(page.getByTestId('rollover-approve-open')).toBeEnabled({ timeout: 15_000 })

  await recordJournal(page, 'Ravi', '100')
  await openManagement(page, 'Rollover')
  await expect(page.getByTestId('rollover-approve-open')).toBeEnabled()

  await goHome(page)
  await openManagement(page, 'Transactions')
  await page.getByTestId('journal-edit').click()
  await expect(page.getByTestId('journal-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Edit Journal/i })).toBeVisible()
  await page.getByTestId('journal-debit-amount').fill('200')
  await page.getByTestId('journal-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()

  await openManagement(page, 'Transactions')
  const rows = page.getByTestId('journal-row')
  await expect(rows).toHaveCount(2)
  await expect(page.getByRole('cell', { name: 'J-1.1', exact: true })).toBeVisible()
  await expect(page.getByText('voided → J-1.1')).toBeVisible()
  await expect(page.getByTestId('journal-edit')).toHaveCount(1)
  await expect(page.getByTestId('journal-delete')).toHaveCount(1)

  await goHome(page)
  await openManagement(page, 'Rollover')
  await expect(page.getByTestId('rollover-approve-open')).toBeEnabled()

  await goHome(page)
  await openManagement(page, 'Transactions')
  await page.getByTestId('journal-delete').click()
  await page.getByTestId('journal-delete-confirm').click()
  await expect(page.getByTestId('journal-delete-dialog')).toBeHidden()
  await expect(page.getByTestId('journal-edit')).toHaveCount(0)
  await expect(page.getByTestId('journal-delete')).toHaveCount(0)
  await expect(page.getByText('voided → J-1.1')).toBeVisible()
  await expect(page.getByText('voided', { exact: true })).toBeVisible()

  const drawer = page.getByTestId('drawer-summary')
  await expect(drawer).toContainText('₹0.00')
  await expect(drawer).not.toContainText('₹200.00')

  await goHome(page)
  await openManagement(page, 'Rollover')
  await expect(page.getByTestId('rollover-approve-open')).toBeEnabled()
})

test('Rollover hides the date editor, names Journals, and wipes them', async ({ page }) => {
  test.setTimeout(60_000)

  await recordJournal(page, 'Ravi', '100')
  await openManagement(page, 'Rollover')
  await expect(page.getByTestId('rollover-page')).toBeVisible()
  await expect(page.getByTestId('edit-bizday-date-section')).toHaveCount(0)

  await page.getByTestId('eod-export').click()
  await expect(page.getByTestId('rollover-approve-open')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('rollover-approve-open').click()

  const confirm = page.getByTestId('rollover-confirm')
  await expect(confirm).toBeVisible()
  await expect(confirm).toContainText('Journals')
  await expect(confirm).not.toContainText('All 0')
  await expect(confirm).toContainText('not on this End of Day Report')

  await page.getByTestId('rollover-approve-confirm').click()
  await expect(page.getByTestId('home-page')).toBeVisible()

  await openManagement(page, 'Transactions')
  await expect(page.getByText('No entries yet today.')).toBeVisible()
  await expect(page.getByTestId('journal-row')).toHaveCount(0)
})

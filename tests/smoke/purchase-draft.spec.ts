import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * High-value Purchase Draft path: park unfinished Purchase, other work, resume, finish.
 * Inventory must not increase while drafted; Finish commits a normal Purchase and drops the Draft.
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

async function seedProduct(page: Page): Promise<void> {
  await openManagement(page, 'Product Master')
  await page.getByTestId('add-product-btn').click()
  await expect(page.getByTestId('product-dialog')).toBeVisible()
  await page.getByTestId('product-name-input').fill('Urad Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  const bagSize = page.getByTestId('product-bag-size-select')
  await expect(bagSize).toBeVisible()
  await bagSize.click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

test('park Purchase Draft → other work → resume → finish; inventory waits for Finish', async ({
  page
}) => {
  test.setTimeout(90_000)

  await seedProduct(page)

  // Inventory starts at 0 for this product (catalog products show with Opening Stock).
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-page')).toBeVisible()
  const uradRow = page.getByTestId('inventory-row').filter({ hasText: 'Urad Dal' })
  await expect(uradRow).toBeVisible()
  await expect(uradRow).toContainText('0')
  await goHome(page)

  // Start a Cash Purchase for a walk-in supplier, park mid-entry.
  await page.getByTestId('open-purchase').click()
  await expect(page.getByTestId('purchase-gate')).toBeVisible()
  await page.getByTestId('purchase-gate-cash').click()
  await dismissAutoPicker(page)
  await expect(page.getByTestId('purchase-save-draft')).toBeVisible()
  await page.getByTestId('purchase-counterparty-mode').click()
  await page.getByRole('option', { name: 'Walk-in' }).click()
  await page.getByTestId('purchase-walkin-name').fill('Parked Supplier')
  await page.getByTestId('purchase-walkin-place').fill('Ongole')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Urad Dal' }).click()
  await page.getByTestId('cart-rate').fill('4800')
  await page.getByTestId('cart-qty').fill('2')
  await expect(page.getByTestId('purchase-total')).toContainText('4,800')

  // Save parks the cart and returns Home.
  await page.getByTestId('purchase-save-draft').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
  await expect(page.getByTestId('home-drafts')).toBeVisible()
  await expect(page.getByTestId('home-drafts')).toContainText('Parked Supplier')
  await expect(page.getByTestId('home-drafts')).toContainText('Purchase')
  await expect(page.getByTestId('recent-transactions')).not.toContainText('Parked Supplier')

  // Inventory still 0 while drafted (no stock increase until Finish).
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row').filter({ hasText: 'Urad Dal' })).toContainText('0')
  await goHome(page)

  // Resume from Home — cart restores parked state.
  const resume = page.locator('[data-testid^="draft-resume-"]').first()
  await resume.click()
  await expect(page.getByTestId('purchase-page')).toBeVisible()
  await expect(page.getByTestId('purchase-walkin-name')).toHaveValue('Parked Supplier')
  await expect(page.getByTestId('purchase-walkin-place')).toHaveValue('Ongole')
  await expect(page.getByTestId('purchase-total')).toContainText('4,800')

  // Finish → normal Purchase; Draft gone; Inventory gains 2 bags.
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await expect(page.getByTestId('txn-row').filter({ hasText: 'Parked Supplier' })).toBeVisible()
  await goHome(page)
  await expect(page.getByTestId('home-drafts')).toHaveCount(0)

  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row').filter({ hasText: 'Urad Dal' })).toContainText('2')
})

test('Save Purchase Draft blocked without counterparty', async ({ page }) => {
  test.setTimeout(60_000)

  await seedProduct(page)
  await page.getByTestId('open-purchase').click()
  await expect(page.getByTestId('purchase-gate')).toBeVisible()
  await page.getByTestId('purchase-gate-cash').click()
  await dismissAutoPicker(page)
  await expect(page.getByTestId('purchase-save-draft')).toBeVisible()
  await page.getByTestId('purchase-save-draft').click()
  await expect(page.getByTestId('purchase-error')).toBeVisible()
  await expect(page.getByTestId('purchase-error')).toContainText(/Customer Master|walk-in/i)
  await goHome(page)
  await expect(page.getByTestId('home-drafts')).toHaveCount(0)
})

import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * High-value Draft path: park an unfinished Sale, do other work, resume, finish.
 * Inventory must not move while drafted; Finish commits a normal Sale and drops the Draft.
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
  await page.getByTestId('product-name-input').fill('Moong Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  // Wait for the bag-size control to settle after group combobox layout.
  const bagSize = page.getByTestId('product-bag-size-select')
  await expect(bagSize).toBeVisible()
  await bagSize.click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

async function purchaseStock(page: Page): Promise<void> {
  await page.getByTestId('open-purchase').click()
  await page.getByTestId('purchase-gate-credit').click()
  await dismissAutoPicker(page)
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Moong Dal' }).click()
  await page.getByTestId('cart-rate').fill('5000')
  await page.getByTestId('cart-qty').fill('4')
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

test('park Sale Draft → other work → resume → finish; inventory waits for Finish', async ({
  page
}) => {
  test.setTimeout(90_000)

  await seedProduct(page)
  await purchaseStock(page)

  // Inventory after purchase: 4 bags.
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('Moong Dal')
  await expect(page.getByTestId('inventory-row')).toContainText('4')
  await goHome(page)

  // Start a Cash Sale for a walk-in, park it mid-entry.
  await page.getByTestId('open-sale').click()
  await expect(page.getByTestId('sale-gate')).toBeVisible()
  await page.getByTestId('sale-gate-cash').click()
  await dismissAutoPicker(page)
  await expect(page.getByTestId('sale-save-draft')).toBeVisible()
  await page.getByTestId('sale-counterparty-mode').click()
  await page.getByRole('option', { name: 'Walk-in' }).click()
  await page.getByTestId('sale-walkin-name').fill('Parked Customer')
  await page.getByTestId('sale-walkin-place').fill('Tenali')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Moong Dal' }).click()
  await page.getByTestId('cart-rate').fill('5500')
  await page.getByTestId('cart-qty').fill('1')
  await expect(page.getByTestId('sale-total')).toContainText('2,750')

  // Save parks the cart and returns Home so the cashier can start other work.
  await page.getByTestId('sale-save-draft').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
  await expect(page.getByTestId('home-drafts')).toBeVisible()
  await expect(page.getByTestId('home-drafts')).toContainText('Parked Customer')
  await expect(page.getByTestId('home-drafts')).toContainText('Sale')
  await expect(page.getByTestId('recent-transactions')).not.toContainText('Parked Customer')

  // Inventory still 4 while drafted.
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('4')
  await goHome(page)

  // Resume from Home — cart restores parked state.
  const resume = page.locator('[data-testid^="draft-resume-"]').first()
  await resume.click()
  await expect(page.getByTestId('sale-page')).toBeVisible()
  await expect(page.getByTestId('sale-walkin-name')).toHaveValue('Parked Customer')
  await expect(page.getByTestId('sale-walkin-place')).toHaveValue('Tenali')
  await expect(page.getByTestId('sale-total')).toContainText('2,750')

  // Finish → normal Sale; Draft gone; Inventory 4 − 1 = 3.
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
  await expect(page.getByTestId('recent-transactions')).toContainText('Parked Customer')
  await expect(page.getByTestId('home-drafts')).toHaveCount(0)

  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('3')
})

test('Save Draft blocked without counterparty', async ({ page }) => {
  test.setTimeout(60_000)

  await seedProduct(page)
  await page.getByTestId('open-sale').click()
  await expect(page.getByTestId('sale-gate')).toBeVisible()
  await page.getByTestId('sale-gate-cash').click()
  await dismissAutoPicker(page)
  await expect(page.getByTestId('sale-save-draft')).toBeVisible()
  // Customer mode selected but no customer picked — save must fail clearly.
  await page.getByTestId('sale-save-draft').click()
  await expect(page.getByTestId('sale-error')).toBeVisible()
  await expect(page.getByTestId('sale-error')).toContainText(/Customer Master|walk-in/i)
  await goHome(page)
  await expect(page.getByTestId('home-drafts')).toHaveCount(0)
})

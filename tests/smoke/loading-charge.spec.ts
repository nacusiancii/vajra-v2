import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Loading Charge by weight breakpoints + loose bulk option.
 * Settings tiers → sale mass → opt-in charge → slip → cash drawer.
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

async function addBulkProduct(
  page: Page,
  name: string,
  group: string,
  bagSizeLabel: string
): Promise<void> {
  await openManagement(page, 'Product Master')
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill(name)
  await page.getByTestId('product-group-combobox').fill(group)
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: bagSizeLabel }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

async function purchaseBulk(
  page: Page,
  productName: string,
  rate: string,
  qty: string
): Promise<void> {
  await page.getByTestId('open-purchase').click()
  await page.getByTestId('purchase-gate-credit').click()
  await dismissAutoPicker(page)
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: productName }).click()
  await page.getByTestId('cart-rate').fill(rate)
  await page.getByTestId('cart-qty').fill(qty)
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function startWalkinSale(page: Page, name: string, place: string): Promise<void> {
  await page.getByTestId('open-sale').click()
  await page.getByTestId('sale-gate-cash').click()
  await dismissAutoPicker(page)
  await page.getByTestId('sale-counterparty-mode').click()
  await page.getByRole('option', { name: 'Walk-in' }).click()
  await page.getByTestId('sale-walkin-name').fill(name)
  await page.getByTestId('sale-walkin-place').fill(place)
}

test('loading charge: weight breakpoints → sale total → slip → cash drawer', async ({ page }) => {
  test.setTimeout(90_000)

  // Defaults: ≤10 → 0, ≤30 → 10, rest → 12 — no Settings save needed for defaults.
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '10')

  await startWalkinSale(page, 'Loading Customer', 'Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  // 2 × 50kg bags = 100 kg goods = 1 quintal × ₹6000; mass 100 kg → ₹12 loading
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  await expect(page.getByTestId('sale-total')).toContainText('6,000')

  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('12')
  await expect(page.getByTestId('sale-total')).toContainText('6,012')
  await expect(page.getByTestId('sale-cash')).toHaveValue('6012')

  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-total')).toContainText('6,000')
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-total')).toContainText('6,012')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('slip-loading')).toBeVisible()
  await expect(page.getByTestId('slip-loading')).toContainText('12')
  await expect(page.getByTestId('slip-preview')).toContainText('6,012')
  await page.getByTestId('slip-done').click()

  await expect(page.getByTestId('home-page')).toBeVisible()
  await openManagement(page, 'Transactions')
  await expect(page.getByTestId('drawer-summary')).toContainText('6,012')
  await goHome(page)

  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('Toor Dal')
  await expect(page.getByTestId('inventory-row')).toContainText('8')
})

test('settings test button and custom breakpoints', async ({ page }) => {
  test.setTimeout(60_000)

  await openManagement(page, 'Settings')
  await expect(page.getByTestId('settings-page')).toBeVisible()
  // Defaults already show three tiers
  await expect(page.getByTestId('loading-breakpoint-row')).toHaveCount(3)

  // Test 25 kg → should be ₹10 (≤30)
  await page.getByTestId('loading-test-weight').fill('25')
  await page.getByTestId('loading-test-run').click()
  await expect(page.getByTestId('loading-test-result')).toContainText('10')

  // Test 50 kg → ₹12
  await page.getByTestId('loading-test-weight').fill('50')
  await page.getByTestId('loading-test-run').click()
  await expect(page.getByTestId('loading-test-result')).toContainText('12')

  // Raise the mid tier to ₹15 and re-test
  await page.getByTestId('loading-bp-charge-1').fill('15')
  await page.getByTestId('loading-test-weight').fill('25')
  await page.getByTestId('loading-test-run').click()
  await expect(page.getByTestId('loading-test-result')).toContainText('15')

  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
})

test('loose bulk: kg qty × price/kg on sale and purchase', async ({ page }) => {
  test.setTimeout(90_000)

  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')

  // Purchase 100 kg loose @ ₹60/kg = ₹6,000 stock-in (100 kg = 2 default bags)
  await page.getByTestId('open-purchase').click()
  await page.getByTestId('purchase-gate-credit').click()
  await dismissAutoPicker(page)
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-mode').click()
  await page.getByRole('option', { name: 'Loose' }).click()
  await page.getByTestId('cart-qty').fill('100')
  // 100 kg exceeds 1–50 — should fail validation
  await page.getByTestId('cart-rate').fill('60')
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('purchase-error')).toBeVisible()
  await expect(page.getByTestId('purchase-error')).toContainText('50')

  await page.getByTestId('cart-qty').fill('50')
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()

  // Inventory: 50 kg / 50 kg default = 1 bag
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('1')
  await goHome(page)

  // Sale 25 kg loose @ ₹70/kg = ₹1,750; mass 25 kg → loading ₹10
  await startWalkinSale(page, 'Loose Buyer', 'Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-mode').click()
  await page.getByRole('option', { name: 'Loose' }).click()
  await page.getByTestId('cart-qty').fill('25')
  await page.getByTestId('cart-rate').fill('70')
  await expect(page.getByTestId('sale-total')).toContainText('1,750')

  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('10')
  await expect(page.getByTestId('sale-total')).toContainText('1,760')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toContainText('loose')
  await expect(page.getByTestId('slip-loading')).toContainText('10')
  await page.getByTestId('slip-done').click()
  await goHome(page)

  // Stock: 50 kg in − 25 kg out = 25 kg = 0.5 default bags
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('0.5')
})

test('loading charge + additional charges stack on the total', async ({ page }) => {
  test.setTimeout(90_000)

  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '5')

  await startWalkinSale(page, 'Stack Charges', 'Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2') // goods 6000, mass 100kg → loading 12

  await page.getByTestId('sale-apply-loading').click()
  await page.getByTestId('sale-additional').fill('100')
  // 6000 + 12 + 100 = 6112
  await expect(page.getByTestId('sale-total')).toContainText('6,112')
  await expect(page.getByTestId('sale-cash')).toHaveValue('6112')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-loading')).toContainText('12')
  await expect(page.getByTestId('slip-preview')).toContainText('6,112')
  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
  await openManagement(page, 'Transactions')
  await expect(page.getByTestId('drawer-summary')).toContainText('6,112')
})

test('mixed cart: packaged lines never add bulk mass for loading', async ({ page }) => {
  test.setTimeout(90_000)

  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')

  await openManagement(page, 'Product Master')
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill('Atta 1kg')
  await page.getByTestId('product-group-combobox').fill('Flour')
  await page.getByTestId('product-type-select').click()
  await page.getByRole('option', { name: 'Packaged' }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)

  await purchaseBulk(page, 'Toor Dal', '6000', '5')

  await page.getByTestId('open-purchase').click()
  await page.getByTestId('purchase-gate-credit').click()
  await dismissAutoPicker(page)
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Atta 1kg' }).click()
  await page.getByTestId('cart-rate').fill('40')
  await page.getByTestId('cart-qty').fill('20')
  await page.getByTestId('purchase-finish').click()
  await goHome(page)

  await startWalkinSale(page, 'Mixed Cart', 'Guntur')
  // 1 × 50kg bag @ 6000 = ₹3000, mass 50 kg → loading ₹12
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('1')

  await page.getByTestId('cart-add-line').click()
  const lines = page.getByTestId('cart-line')
  await lines.nth(1).getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Atta 1kg' }).click()
  await lines.nth(1).getByTestId('cart-rate').fill('40')
  await lines.nth(1).getByTestId('cart-qty').fill('5')

  await expect(page.getByTestId('sale-total')).toContainText('3,200')
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('12')
  await expect(page.getByTestId('sale-total')).toContainText('3,212')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-loading')).toContainText('12')
  await page.getByTestId('slip-done').click()
})

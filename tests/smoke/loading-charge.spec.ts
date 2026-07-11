import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * End-to-end Loading Charge flow — was never proven in the smoke suite.
 *
 * Settings rates → product → purchase stock → Sale with opt-in loading →
 * live total, slip, cash drawer, inventory (stock unaffected by loading money).
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

async function configureLoadingRates(
  page: Page,
  rates: Partial<Record<25 | 30 | 50, number>>
): Promise<void> {
  await openManagement(page, 'Settings')
  await expect(page.getByTestId('settings-page')).toBeVisible()
  for (const [size, rate] of Object.entries(rates)) {
    await page.getByTestId(`bag-type-rate-${size}`).fill(String(rate))
  }
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await goHome(page)
}

async function purchaseBulk(
  page: Page,
  productName: string,
  rate: string,
  qty: string
): Promise<void> {
  await page.getByTestId('open-purchase').click()
  // Cash/Credit gate comes first — pick Credit so stock-in has no drawer impact.
  await page.getByTestId('purchase-gate-credit').click()
  await dismissAutoPicker(page)
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: productName }).click()
  await page.getByTestId('cart-rate').fill(rate)
  await page.getByTestId('cart-qty').fill(qty)
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await goHome(page)
}

async function startWalkinSale(page: Page, name: string, place: string): Promise<void> {
  await page.getByTestId('open-sale').click()
  // Cash/Credit gate comes first — walk-in is only available on Cash Sales.
  await page.getByTestId('sale-gate-cash').click()
  // Customer mode auto-opens its picker; dismiss before switching to walk-in.
  await dismissAutoPicker(page)
  await page.getByTestId('sale-counterparty-mode').click()
  await page.getByRole('option', { name: 'Walk-in' }).click()
  await page.getByTestId('sale-walkin-name').fill(name)
  await page.getByTestId('sale-walkin-place').fill(place)
}

test('loading charge: settings → sale total → slip → cash drawer', async ({ page }) => {
  test.setTimeout(90_000)

  // ₹20 per 50kg bag, ₹10 per 25kg bag
  await configureLoadingRates(page, { 50: 20, 25: 10, 30: 12 })
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '10')

  await startWalkinSale(page, 'Loading Customer', 'Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  // Defaults to product Default Bag Size (50 kg)
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  // Goods only: 2 × 50kg = 100kg = 1 quintal × ₹6000
  await expect(page.getByTestId('sale-total')).toContainText('6,000')

  // Opt-in: 2 bags × ₹20 = ₹40 → total ₹6,040
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('40')
  await expect(page.getByTestId('sale-total')).toContainText('6,040')
  await expect(page.getByTestId('sale-cash')).toHaveValue('6040')

  // Toggle off restores goods-only total
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-total')).toContainText('6,000')
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-total')).toContainText('6,040')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('slip-loading')).toBeVisible()
  await expect(page.getByTestId('slip-loading')).toContainText('40')
  // Grand total on slip includes loading
  await expect(page.getByTestId('slip-preview')).toContainText('6,040')
  await page.getByTestId('slip-done').click()

  // Cash drawer must include the loading surcharge
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await expect(page.getByTestId('drawer-summary')).toContainText('6,040')
  await goHome(page)

  // Stock: 10 − 2 = 8 (loading is money only)
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('Toor Dal')
  await expect(page.getByTestId('inventory-row')).toContainText('8')
})

test('loading charge uses the line Bag Type rate, not Default Bag Size', async ({ page }) => {
  test.setTimeout(90_000)

  await configureLoadingRates(page, { 50: 20, 25: 10 })
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '20')

  await startWalkinSale(page, 'Bag Split', 'Vijayawada')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  // Override to 25 kg bags: same 100kg goods, different loading key
  await page.getByTestId('cart-bag').click()
  await page.getByRole('option', { name: '25 kg' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('4') // 4 × 25kg = 100kg = ₹6000 goods

  await expect(page.getByTestId('sale-total')).toContainText('6,000')
  await page.getByTestId('sale-apply-loading').click()
  // 4 × ₹10 = ₹40 (not 4 × ₹20)
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('40')
  await expect(page.getByTestId('sale-total')).toContainText('6,040')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-loading')).toContainText('40')
  await page.getByTestId('slip-done').click()
  await goHome(page)

  // Stock in default-50 units: 4 × (25/50) = 2 bags out → 20 − 2 = 18
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('18')
})

test('loading charge is 0 until rates are configured (defaults are zero)', async ({ page }) => {
  test.setTimeout(60_000)

  // Fresh install: no Settings save — rates stay at 0
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '5')

  await startWalkinSale(page, 'Zero Rate', 'Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  await page.getByTestId('sale-apply-loading').click()
  // Opt-in with zero rates: label shows ₹0.00, total unchanged
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('0.00')
  await expect(page.getByTestId('sale-total')).toContainText('6,000')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  // slip-loading is v-if="txn.loadingCharges" — falsy 0 means no Loading row
  await expect(page.getByTestId('slip-loading')).toHaveCount(0)
  await page.getByTestId('slip-done').click()
})

test('mixed cart: packaged lines never contribute to loading', async ({ page }) => {
  test.setTimeout(90_000)

  await configureLoadingRates(page, { 50: 20 })
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')

  // Packaged product
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

  // Purchase packaged stock too
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
  // Bulk line: 1 × 50kg @ 6000 = ₹3000 goods, loading ₹20
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('1')

  // Packaged: 5 × ₹40 = ₹200, no loading
  await page.getByTestId('cart-add-line').click()
  const lines = page.getByTestId('cart-line')
  await lines.nth(1).getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Atta 1kg' }).click()
  await lines.nth(1).getByTestId('cart-rate').fill('40')
  await lines.nth(1).getByTestId('cart-qty').fill('5')

  // Goods only: 3000 + 200 = 3200
  await expect(page.getByTestId('sale-total')).toContainText('3,200')
  await page.getByTestId('sale-apply-loading').click()
  // Only bulk bag contributes: +₹20 → 3220
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('20')
  await expect(page.getByTestId('sale-total')).toContainText('3,220')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-loading')).toContainText('20')
  await page.getByTestId('slip-done').click()
})

test('loading charge + additional charges stack on the total', async ({ page }) => {
  test.setTimeout(90_000)

  await configureLoadingRates(page, { 50: 20 })
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '5')

  await startWalkinSale(page, 'Stack Charges', 'Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2') // goods 6000

  await page.getByTestId('sale-apply-loading').click() // +40
  await page.getByTestId('sale-additional').fill('100') // +100
  // 6000 + 40 + 100 = 6140
  await expect(page.getByTestId('sale-total')).toContainText('6,140')
  await expect(page.getByTestId('sale-cash')).toHaveValue('6140')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('slip-loading')).toContainText('40')
  await expect(page.getByTestId('slip-preview')).toContainText('6,140')
  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('drawer-summary')).toContainText('6,140')
})

test('adding a custom bag type in Settings appears on the Sale cart', async ({ page }) => {
  test.setTimeout(90_000)

  await openManagement(page, 'Settings')
  await page.getByTestId('new-bag-size').fill('40')
  await page.getByTestId('add-bag-type').click()
  await expect(page.getByTestId('bag-type-row')).toHaveCount(4)
  await page.getByTestId('bag-type-rate-40').fill('15')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await goHome(page)

  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '10')

  await startWalkinSale(page, 'Custom Bag', 'Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-bag').click()
  // Custom 40 kg must be selectable even though product default is 50
  await page.getByRole('option', { name: '40 kg' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('5') // 200kg = 2q = ₹12,000 goods

  await page.getByTestId('sale-apply-loading').click()
  // 5 × ₹15 = ₹75
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('75')
  await expect(page.getByTestId('sale-total')).toContainText('12,075')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-loading')).toContainText('75')
  await page.getByTestId('slip-done').click()
  await goHome(page)

  // Stock: 5 × (40/50) = 4 default bags out → 10 − 4 = 6
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('6')
})

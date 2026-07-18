import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * End-to-end Loading Charge flow with weight breakpoints.
 *
 * Settings breakpoints → product → purchase stock → Sale with opt-in loading →
 * live total, slip, cash drawer, inventory (stock unaffected by loading money).
 * Also covers a Loose cart line on a Sale.
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

/**
 * Configure breakpoints: index 0 = ≤10kg, index 1 = ≤30kg, plus above-last.
 * Defaults already match ₹0 / ₹10 / ₹12 — only override when needed.
 */
async function configureLoadingDefaults(page: Page): Promise<void> {
  await openManagement(page, 'Settings')
  await expect(page.getByTestId('settings-page')).toBeVisible()
  // Ensure default-like values (form may already have them)
  await page.getByTestId('loading-bp-kg-0').fill('10')
  await page.getByTestId('loading-bp-rate-0').fill('0')
  await page.getByTestId('loading-bp-kg-1').fill('30')
  await page.getByTestId('loading-bp-rate-1').fill('10')
  await page.getByTestId('loading-above-rate').fill('12')
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
  // Credit Purchase from Home — stock-in with no drawer impact.
  await page.getByTestId('open-credit-purchase').click()
  await dismissAutoPicker(page)
  // Cart opens with one blank goods row — no Add Line needed to start.
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: productName }).click()
  await page.getByTestId('cart-rate').fill(rate)
  await page.getByTestId('cart-qty').fill(qty)
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function startWalkinSale(page: Page, name: string, place: string): Promise<void> {
  // Cash Sale from Home — walk-in is only available on Cash Sales; defaults to Walk-in.
  await page.getByTestId('open-cash-sale').click()
  await expect(page.getByTestId('sale-counterparty-mode')).toContainText('Walk in')
  await page.getByTestId('sale-walkin-name').fill(name)
  await page.getByTestId('sale-walkin-place').fill(place)
}

test('loading charge: settings → sale total → slip → cash drawer', async ({ page }) => {
  test.setTimeout(90_000)

  // Defaults: ≤10 → ₹0, ≤30 → ₹10, above → ₹12. 50kg bag → ₹12 each.
  await configureLoadingDefaults(page)
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '10')

  await startWalkinSale(page, 'Loading Customer', 'Guntur')
  // Cart opens with one blank goods row — no Add Line needed to start.
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  // Defaults to product Default Bag Size (50 kg)
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  // Goods only: 2 × 50kg = 100kg = 1 quintal × ₹6000
  await expect(page.getByTestId('sale-total')).toContainText('6,000')

  // Opt-in: 2 bags × ₹12 = ₹24 → total ₹6,024
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('24')
  await expect(page.getByTestId('sale-total')).toContainText('6,024')
  await expect(page.getByTestId('sale-cash')).toHaveValue('6024')

  // Toggle off restores goods-only total
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-total')).toContainText('6,000')
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-total')).toContainText('6,024')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('slip-preview')).toContainText('Write a manual copy')
  await expect(page.getByTestId('slip-loading')).toBeVisible()
  await expect(page.getByTestId('slip-loading')).toContainText('24')
  // Grand total on slip includes loading
  await expect(page.getByTestId('slip-preview')).toContainText('6,024')
  await page.getByTestId('slip-done').click()

  // Done returns Home; open ledger to confirm cash drawer includes loading surcharge.
  await expect(page.getByTestId('home-page')).toBeVisible()
  await openManagement(page, 'Transactions')
  await expect(page.getByTestId('drawer-summary')).toContainText('6,024')
  await goHome(page)

  // Stock: 10 − 2 = 8 (loading is money only)
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('Toor Dal')
  await expect(page.getByTestId('inventory-row')).toContainText('8')
})

test('loading charge uses bag weight breakpoints, not bag-type table', async ({ page }) => {
  test.setTimeout(90_000)

  await configureLoadingDefaults(page)
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '20')

  await startWalkinSale(page, 'Bag Split', 'Vijayawada')
  // Cart opens with one blank goods row — no Add Line needed to start.
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  // Override to 25 kg bags: same 100kg goods, loading from 25kg band (₹10)
  await page.getByTestId('cart-bag').click()
  await page.getByRole('option', { name: '25 kg' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('4') // 4 × 25kg = 100kg = ₹6000 goods

  await expect(page.getByTestId('sale-total')).toContainText('6,000')
  await page.getByTestId('sale-apply-loading').click()
  // 4 × ₹10 = ₹40
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

test('loading charge zero band until weight exceeds 10 kg', async ({ page }) => {
  test.setTimeout(60_000)

  await configureLoadingDefaults(page)
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  // Purchase enough for loose later; still need bag purchase for stock
  await purchaseBulk(page, 'Toor Dal', '6000', '5')

  await startWalkinSale(page, 'Zero Band', 'Guntur')
  // Cart opens with one blank goods row — no Add Line needed to start.
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  // Loose 8 kg → ≤10 → ₹0 loading
  await page.getByTestId('cart-bag').click()
  await page.getByRole('option', { name: 'Loose' }).click()
  await page.getByTestId('cart-rate').fill('60')
  await page.getByTestId('cart-qty').fill('8')

  // Goods: 8 × ₹60 = ₹480
  await expect(page.getByTestId('sale-total')).toContainText('480')
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('0.00')
  await expect(page.getByTestId('sale-total')).toContainText('480')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  // slip-loading is v-if="txn.loadingCharges" — falsy 0 means no Loading row
  await expect(page.getByTestId('slip-loading')).toHaveCount(0)
  await page.getByTestId('slip-done').click()
})

test('edit keeps loading opt-in when stored charge is ₹0 (free band)', async ({ page }) => {
  // Finding: rehydrate from amount (> 0) dropped opt-in on free-band Sales.
  // Fix: persist loading_applied; Edit must restore the toggle from the flag.
  test.setTimeout(90_000)

  await configureLoadingDefaults(page)
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '10')

  await startWalkinSale(page, 'Free Band Edit', 'Guntur')
  // Cart opens with one blank goods row — no Add Line needed to start.
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  // Loose 8 kg → free band → ₹0 loading when opted in
  await page.getByTestId('cart-bag').click()
  await page.getByRole('option', { name: 'Loose' }).click()
  await page.getByTestId('cart-rate').fill('60')
  await page.getByTestId('cart-qty').fill('8')
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-loading-amount')).toContainText('0.00')
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()

  // Edit the live Sale from Home recent list
  await page.getByTestId('home-txn-row').first().getByTestId('txn-edit').click()
  await expect(page.getByTestId('sale-page')).toBeVisible()
  // Toggle must still be on (amount is still ₹0 free band)
  await expect(page.getByTestId('sale-apply-loading')).toHaveAttribute('data-state', 'checked')
  await expect(page.getByTestId('sale-loading-amount')).toContainText('0.00')

  // Adding a 50 kg bag under opt-in must now charge loading (successor recomputes)
  await page.getByTestId('cart-add-line').click()
  // Second line: product combobox — use last cart-product
  await page.getByTestId('cart-product').last().click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').last().fill('6000')
  await page.getByTestId('cart-qty').last().fill('1')
  // 50 kg bag → above → ₹12 loading
  await expect(page.getByTestId('sale-loading-amount')).toContainText('12')
})

test('loose line: kg × price/kg total, stock delta, loading by total kg', async ({ page }) => {
  test.setTimeout(90_000)

  await configureLoadingDefaults(page)
  await addBulkProduct(page, 'Toor Dal', 'Dal', '50 kg')
  await purchaseBulk(page, 'Toor Dal', '6000', '10')

  await startWalkinSale(page, 'Loose Customer', 'Guntur')
  // Cart opens with one blank goods row — no Add Line needed to start.
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-bag').click()
  await page.getByRole('option', { name: 'Loose' }).click()
  // 15 kg × ₹60/kg = ₹900; loading ≤30 → ₹10
  await page.getByTestId('cart-rate').fill('60')
  await page.getByTestId('cart-qty').fill('15')

  await expect(page.getByTestId('sale-total')).toContainText('900')
  await page.getByTestId('sale-apply-loading').click()
  await expect(page.getByTestId('sale-apply-loading-label')).toContainText('10')
  await expect(page.getByTestId('sale-total')).toContainText('910')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('slip-line-loose')).toBeVisible()
  await expect(page.getByTestId('slip-loading')).toContainText('10')
  await page.getByTestId('slip-done').click()
  await goHome(page)

  // Stock: 10 bags − 15kg/50kg = 10 − 0.3 = 9.7
  await openManagement(page, 'Inventory')
  await expect(page.getByTestId('inventory-row')).toContainText('Toor Dal')
  await expect(page.getByTestId('inventory-row')).toContainText('9.7')
})

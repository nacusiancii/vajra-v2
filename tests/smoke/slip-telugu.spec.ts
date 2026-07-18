import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * ADR-0003 / #132: customer-facing Sale Invoice and Credit Voucher show Telugu
 * for customer name, place, and product lines when masters have translations;
 * English when Telugu is missing (no blank gap). Operator UI stays English.
 */

const CUSTOMER_EN = 'Ravi Kumar'
const CUSTOMER_TE = 'రవి కుమార్'
const PLACE_EN = 'Guntur'
const PLACE_TE = 'గుంటూరు'
const PRODUCT_EN = 'Toor Dal'
const PRODUCT_TE = 'కందిపప్పు'

const NO_TE_CUSTOMER = 'Lakshmi Devi'
const NO_TE_PLACE = 'Vijayawada'
const NO_TE_PRODUCT = 'Urad Dal'

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function seedProduct(page: Page, name: string, nameTe?: string): Promise<void> {
  await page.getByTestId('management-links').getByText('Product Master').click()
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill(name)
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  if (nameTe) {
    await page.getByTestId('product-name-te-input').fill(nameTe)
  }
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

async function seedCustomer(
  page: Page,
  opts: { name: string; place: string; phone?: string; nameTe?: string; placeTe?: string }
): Promise<void> {
  await page.getByTestId('management-links').getByText('Customer Master').click()
  await page.getByTestId('add-customer-btn').click()
  await page.getByTestId('customer-name-input').fill(opts.name)
  await page.getByTestId('customer-place-combobox').fill(opts.place)
  if (opts.phone) {
    await page.getByTestId('customer-phone-input').fill(opts.phone)
  }
  if (opts.nameTe) {
    await page.getByTestId('customer-name-te-input').fill(opts.nameTe)
  }
  if (opts.placeTe) {
    await page.getByTestId('customer-place-te-input').fill(opts.placeTe)
  }
  await page.getByTestId('customer-submit').click()
  await expect(page.getByTestId('customer-dialog')).not.toBeVisible()
  await goHome(page)
}

test('cash sale invoice shows Telugu for customer, place, and product', async ({ page }) => {
  test.setTimeout(60_000)

  await seedProduct(page, PRODUCT_EN, PRODUCT_TE)
  await seedCustomer(page, {
    name: CUSTOMER_EN,
    place: PLACE_EN,
    nameTe: CUSTOMER_TE,
    placeTe: PLACE_TE
  })

  await page.getByTestId('open-cash-sale').click()
  await expect(page.getByTestId('sale-page')).toHaveAttribute('data-mode', 'cash')

  // Switch from default walk-in to Customer Master with Telugu.
  await page.getByTestId('sale-counterparty-mode').click()
  await page.getByRole('option', { name: 'Customer Master' }).click()
  await dismissAutoPicker(page)
  await page.getByTestId('sale-customer').click()
  await page.getByPlaceholder(/Type a customer name/).fill('Ravi')
  await page.getByRole('option', { name: new RegExp(CUSTOMER_EN) }).click()

  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  // Operator catalog stays English.
  await expect(page.getByRole('option', { name: PRODUCT_EN })).toBeVisible()
  await page.getByRole('option', { name: PRODUCT_EN }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await expect(page.getByTestId('sale-invoice')).toBeVisible()

  await expect(page.getByTestId('slip-customer')).toHaveText(CUSTOMER_TE)
  await expect(page.getByTestId('slip-place')).toHaveText(PLACE_TE)
  await expect(page.getByTestId('slip-line-product')).toContainText(PRODUCT_TE)
  await expect(page.getByTestId('slip-customer')).not.toHaveText(CUSTOMER_EN)
  await expect(page.getByTestId('slip-place')).not.toHaveText(PLACE_EN)

  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
})

test('credit sale invoice and voucher show Telugu where seeded', async ({ page }) => {
  test.setTimeout(60_000)

  await page.getByRole('link', { name: /Settings/ }).click()
  await page.getByTestId('company-name-input').fill('Sri Venkateswara Traders')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await goHome(page)

  await seedProduct(page, PRODUCT_EN, PRODUCT_TE)
  await seedCustomer(page, {
    name: CUSTOMER_EN,
    place: PLACE_EN,
    phone: '9876543210',
    nameTe: CUSTOMER_TE,
    placeTe: PLACE_TE
  })

  await page.getByTestId('open-credit-sale').click()
  await expect(page.getByTestId('sale-page')).toHaveAttribute('data-mode', 'credit')
  await page.getByPlaceholder(/Type a customer name/).fill('Ravi')
  await page.getByRole('option', { name: new RegExp(CUSTOMER_EN) }).click()

  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await page.getByRole('option', { name: PRODUCT_EN }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('2')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('credit-finish-panel')).toBeVisible()

  await expect(page.getByTestId('sale-invoice')).toBeVisible()
  await expect(page.getByTestId('slip-customer')).toHaveText(CUSTOMER_TE)
  await expect(page.getByTestId('slip-place')).toHaveText(PLACE_TE)
  await expect(page.getByTestId('slip-line-product')).toContainText(PRODUCT_TE)
  await expect(page.getByTestId('slip-phone')).toHaveText('9876543210')

  await expect(page.getByTestId('voucher-front')).toBeVisible()
  await expect(page.getByTestId('voucher-customer')).toHaveText(CUSTOMER_TE)
  await expect(page.getByTestId('voucher-place')).toHaveText(PLACE_TE)
  await expect(page.getByTestId('voucher-phone')).toHaveText('9876543210')

  await page.getByTestId('voucher-show-back').click()
  await expect(page.getByTestId('voucher-back')).toBeVisible()
  const line = page.getByTestId('voucher-line')
  await expect(line).toHaveCount(1)
  await expect(line).toContainText(PRODUCT_TE)
  await expect(line).not.toContainText(PRODUCT_EN)

  await page.getByTestId('credit-finish-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
})

test('masters without Telugu still show English on invoice and voucher', async ({ page }) => {
  test.setTimeout(60_000)

  await page.getByRole('link', { name: /Settings/ }).click()
  await page.getByTestId('company-name-input').fill('Sri Venkateswara Traders')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await goHome(page)

  // No Telugu translations on product or customer.
  await seedProduct(page, NO_TE_PRODUCT)
  await seedCustomer(page, {
    name: NO_TE_CUSTOMER,
    place: NO_TE_PLACE,
    phone: '9123456780'
  })

  await page.getByTestId('open-credit-sale').click()
  await expect(page.getByTestId('sale-page')).toHaveAttribute('data-mode', 'credit')
  await page.getByPlaceholder(/Type a customer name/).fill('Lakshmi')
  await page.getByRole('option', { name: new RegExp(NO_TE_CUSTOMER) }).click()

  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await page.getByRole('option', { name: NO_TE_PRODUCT }).click()
  await page.getByTestId('cart-rate').fill('5000')
  await page.getByTestId('cart-qty').fill('1')

  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('credit-finish-panel')).toBeVisible()

  // English fallback — never blank / dashed gap for missing Telugu.
  await expect(page.getByTestId('slip-customer')).toHaveText(NO_TE_CUSTOMER)
  await expect(page.getByTestId('slip-place')).toHaveText(NO_TE_PLACE)
  await expect(page.getByTestId('slip-line-product')).toContainText(NO_TE_PRODUCT)
  await expect(page.getByTestId('slip-customer')).not.toHaveText('')
  await expect(page.getByTestId('slip-place')).not.toHaveText('—')

  await expect(page.getByTestId('voucher-customer')).toHaveText(NO_TE_CUSTOMER)
  await expect(page.getByTestId('voucher-place')).toHaveText(NO_TE_PLACE)

  await page.getByTestId('voucher-show-back').click()
  await expect(page.getByTestId('voucher-line')).toContainText(NO_TE_PRODUCT)

  await page.getByTestId('credit-finish-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
})

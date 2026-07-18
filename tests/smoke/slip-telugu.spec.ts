import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * ADR-0003 / #132: customer-facing Sale Invoice and Credit Voucher show Telugu
 * for customer name, place, and product lines when masters have translations.
 * Operator UI stays English (catalog pickers still show English names).
 */

const CUSTOMER_EN = 'Ravi Kumar'
const CUSTOMER_TE = 'రవి కుమార్'
const PLACE_EN = 'Guntur'
const PLACE_TE = 'గుంటూరు'
const PRODUCT_EN = 'Toor Dal'
const PRODUCT_TE = 'కందిపప్పు'

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function seedProductWithTelugu(page: Page): Promise<void> {
  await page.getByTestId('management-links').getByText('Product Master').click()
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill(PRODUCT_EN)
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-name-te-input').fill(PRODUCT_TE)
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

async function seedCustomerWithTelugu(page: Page, withPhone: boolean): Promise<void> {
  await page.getByTestId('management-links').getByText('Customer Master').click()
  await page.getByTestId('add-customer-btn').click()
  await page.getByTestId('customer-name-input').fill(CUSTOMER_EN)
  await page.getByTestId('customer-place-combobox').fill(PLACE_EN)
  if (withPhone) {
    await page.getByTestId('customer-phone-input').fill('9876543210')
  }
  await page.getByTestId('customer-name-te-input').fill(CUSTOMER_TE)
  await page.getByTestId('customer-place-te-input').fill(PLACE_TE)
  await page.getByTestId('customer-submit').click()
  await expect(page.getByTestId('customer-dialog')).not.toBeVisible()
  await goHome(page)
}

test('cash sale invoice shows Telugu for customer, place, and product', async ({ page }) => {
  test.setTimeout(60_000)

  await seedProductWithTelugu(page)
  await seedCustomerWithTelugu(page, false)

  await page.getByTestId('open-cash-sale').click()
  await expect(page.getByTestId('sale-page')).toHaveAttribute('data-mode', 'cash')

  // Switch from default walk-in to Customer Master with Telugu.
  await page.getByTestId('sale-counterparty-mode').click()
  await page.getByRole('option', { name: 'Customer Master' }).click()
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
  // Must not English-fallback customer/place on the face.
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

  await seedProductWithTelugu(page)
  await seedCustomerWithTelugu(page, true)

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

  // Sale Invoice (left column).
  await expect(page.getByTestId('sale-invoice')).toBeVisible()
  await expect(page.getByTestId('slip-customer')).toHaveText(CUSTOMER_TE)
  await expect(page.getByTestId('slip-place')).toHaveText(PLACE_TE)
  await expect(page.getByTestId('slip-line-product')).toContainText(PRODUCT_TE)
  await expect(page.getByTestId('slip-phone')).toHaveText('9876543210')

  // Credit Voucher front.
  await expect(page.getByTestId('voucher-front')).toBeVisible()
  await expect(page.getByTestId('voucher-customer')).toHaveText(CUSTOMER_TE)
  await expect(page.getByTestId('voucher-place')).toHaveText(PLACE_TE)
  await expect(page.getByTestId('voucher-phone')).toHaveText('9876543210')

  // Voucher back product lines.
  await page.getByTestId('voucher-show-back').click()
  await expect(page.getByTestId('voucher-back')).toBeVisible()
  const line = page.getByTestId('voucher-line')
  await expect(line).toHaveCount(1)
  await expect(line).toContainText(PRODUCT_TE)
  await expect(line).not.toContainText(PRODUCT_EN)

  await page.getByTestId('credit-finish-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
})

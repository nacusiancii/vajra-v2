import { test, expect, dismissAutoPicker } from './fixtures'
import type { Locator, Page } from '@playwright/test'

/**
 * High-value cashier paths for NumericField (issue #21 / #108):
 * replace-all on keyboard/programmatic focus, click-to-place caret,
 * intermediate strings, qty 1dp, invalid blur revert.
 */

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function seedBulkProduct(page: Page): Promise<void> {
  await page.getByTestId('management-links').getByText('Product Master').click()
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill('Numeric Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

async function openCashSaleCart(page: Page): Promise<void> {
  await page.getByTestId('open-sale').click()
  await expect(page.getByTestId('sale-gate-cash')).toBeFocused()
  await page.keyboard.press('Enter')
  await dismissAutoPicker(page)
  await page.getByTestId('sale-counterparty-mode').click()
  await page.getByRole('option', { name: 'Walk in' }).click()
  await page.getByTestId('sale-walkin-name').fill('Counter')
  await page.getByTestId('sale-walkin-place').fill('Guntur')
  await page.getByTestId('cart-add-line').click()
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Numeric Dal' }).click()
  await expect(page.getByTestId('cart-qty')).toBeFocused()
}

async function selectionState(locator: Locator): Promise<{
  start: number
  end: number
  length: number
}> {
  return locator.evaluate((el) => {
    const input = el as HTMLInputElement
    return {
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? 0,
      length: input.value.length
    }
  })
}

test('money field: replace-all retype commits intended amount (no 2000→0→3 jank)', async ({
  page
}) => {
  test.setTimeout(60_000)
  await seedBulkProduct(page)
  await openCashSaleCart(page)

  const rate = page.getByTestId('cart-rate')
  // Seed a committed rate of ₹2000 (select-all on focus is automatic).
  await rate.fill('2000')
  await rate.blur()
  await expect(rate).toHaveValue('2000')

  // Counter habit: programmatic / keyboard focus selects all; type full new amount.
  await rate.focus()
  await expect
    .poll(async () => {
      const s = await selectionState(rate)
      return s.start === 0 && s.end === s.length && s.length > 0
    })
    .toBe(true)
  await page.keyboard.type('3000')
  await rate.blur()
  await expect(rate).toHaveValue('3000')

  await page.getByTestId('cart-qty').fill('1')
  // 1 bag × 50kg = 0.5 quintal × ₹3000 = ₹1500
  await expect(page.getByTestId('sale-total')).toContainText('1,500')
})

test('money field: mouse click places caret (no select-all)', async ({ page }) => {
  test.setTimeout(60_000)
  await seedBulkProduct(page)
  await openCashSaleCart(page)

  const rate = page.getByTestId('cart-rate')
  await rate.fill('2000')
  await rate.blur()
  await expect(rate).toHaveValue('2000')

  // Click toward the start of the value so the caret is not a full selection.
  const box = await rate.boundingBox()
  expect(box).not.toBeNull()
  await rate.click({ position: { x: 14, y: (box?.height ?? 20) / 2 } })

  await expect
    .poll(async () => {
      const s = await selectionState(rate)
      // Caret (collapsed), not the whole string selected.
      return s.start === s.end && s.length === 4
    })
    .toBe(true)

  // Insert at caret — must not replace the whole value.
  await page.keyboard.type('9')
  await rate.blur()
  const value = await rate.inputValue()
  expect(value).toContain('9')
  expect(value).not.toBe('9')
  expect(value.length).toBe(5)
})

test('money field: Tab focus still selects all', async ({ page }) => {
  test.setTimeout(60_000)
  await seedBulkProduct(page)
  await openCashSaleCart(page)

  const qty = page.getByTestId('cart-qty')
  const rate = page.getByTestId('cart-rate')
  await rate.fill('2000')
  await rate.blur()
  await expect(rate).toHaveValue('2000')

  // qty → Tab → rate (bag select is between product and qty; rate follows qty).
  await qty.focus()
  await page.keyboard.press('Tab')
  await expect(rate).toBeFocused()

  await expect
    .poll(async () => {
      const s = await selectionState(rate)
      return s.start === 0 && s.end === s.length && s.length === 4
    })
    .toBe(true)

  await page.keyboard.type('3500')
  await rate.blur()
  await expect(rate).toHaveValue('3500')
})

test('qty field: 3.7 commits and drives line math', async ({ page }) => {
  test.setTimeout(60_000)
  await seedBulkProduct(page)
  await openCashSaleCart(page)

  // Loose line: qty is kg, rate is ₹/kg
  await page.getByTestId('cart-bag').click()
  await page.getByTestId('cart-loose').click()

  const qty = page.getByTestId('cart-qty')
  await qty.fill('3.7')
  await qty.blur()
  await expect(qty).toHaveValue('3.7')

  await page.getByTestId('cart-rate').fill('100')
  await page.getByTestId('cart-rate').blur()
  // 3.7 kg × ₹100/kg = ₹370
  await expect(page.getByTestId('sale-total')).toContainText('370')
})

test('invalid blur reverts money field to last good value', async ({ page }) => {
  test.setTimeout(60_000)
  await seedBulkProduct(page)
  await openCashSaleCart(page)

  const rate = page.getByTestId('cart-rate')
  await rate.fill('2500')
  await rate.blur()
  await expect(rate).toHaveValue('2500')

  // Programmatic focus → select-all; replace with unparseable fragment.
  await rate.focus()
  await page.keyboard.type('.')
  await rate.blur()
  // Unparseable → last good domain value, not garbage.
  await expect(rate).toHaveValue('2500')
})

test('empty money field commits null; finish still requires a positive amount', async ({
  page
}) => {
  await page.getByTestId('secondary-actions').getByRole('link', { name: 'Expense' }).click()
  await expect(page.getByTestId('money-page')).toBeVisible()

  const amount = page.getByTestId('money-amount')
  await amount.fill('50')
  await amount.blur()
  await expect(amount).toHaveValue('50')

  // Focus select-alls; clear and blur → null, not a garbage number.
  await amount.focus()
  await page.keyboard.press('Backspace')
  await amount.blur()
  await expect(amount).toHaveValue('')

  await page.getByTestId('money-label').fill('Tea')
  await page.getByTestId('money-finish').click()
  await expect(page.getByTestId('money-error')).toBeVisible()
  await expect(page.getByTestId('money-error')).toContainText(/greater than zero/i)
})

import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Configurable cart line-item cap (#19): Settings value applies to Sale cart adds;
 * Add Line disables at the cap (no silent extra lines).
 */

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

test('settings max line items disables Add Line at the cap on Sale', async ({ page }) => {
  test.setTimeout(60_000)

  await page
    .getByTestId('management-links')
    .getByRole('link', { name: /^Settings/ })
    .click()
  await expect(page.getByTestId('settings-page')).toBeVisible()
  await expect(page.getByTestId('max-line-items-input')).toHaveValue('10')
  await page.getByTestId('max-line-items-input').fill('2')
  await page.getByTestId('settings-save').click()
  await expect(page.getByTestId('settings-saved')).toBeVisible()
  await goHome(page)

  await page.getByTestId('open-sale').click()
  await page.getByTestId('sale-gate-cash').click()
  await dismissAutoPicker(page)

  const addLine = page.getByTestId('cart-add-line')
  await expect(addLine).toBeEnabled()
  await addLine.click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(addLine).toBeEnabled()
  await addLine.click()
  await expect(page.getByTestId('cart-line')).toHaveCount(2)
  await expect(addLine).toBeDisabled()
})

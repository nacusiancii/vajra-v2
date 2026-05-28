import { test, expect } from './fixtures'

test.describe('Home page', () => {
  test('shows primary counter actions', async ({ page }) => {
    await expect(page.getByTestId('home-page')).toBeVisible()
    await expect(page.getByTestId('primary-actions')).toBeVisible()
    await expect(page.getByRole('link', { name: /New Sale/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /New Purchase/i })).toBeVisible()
  })

  test('shows recent transactions affordance', async ({ page }) => {
    await expect(page.getByTestId('recent-transactions')).toBeVisible()
    await expect(page.getByText(/No transactions yet/)).toBeVisible()
  })

  test('shows shopkeeper management links', async ({ page }) => {
    const section = page.getByTestId('management-links')
    await expect(section).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Product Master' })).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Customer Master' })).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Inventory' })).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Rollover' })).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test('Sale link navigates to placeholder', async ({ page }) => {
    await page.getByRole('link', { name: /New Sale/i }).click()
    await expect(page.getByTestId('placeholder-sale')).toBeVisible()
  })

  test('management link navigates to Product Master', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()
    await expect(page.getByTestId('product-master-page')).toBeVisible()
  })

  test('Vajra header link returns home', async ({ page }) => {
    await page.getByRole('link', { name: /New Sale/i }).click()
    await expect(page.getByTestId('placeholder-sale')).toBeVisible()

    await page.getByRole('link', { name: /Vajra/i }).click()
    await expect(page.getByTestId('home-page')).toBeVisible()
  })
})

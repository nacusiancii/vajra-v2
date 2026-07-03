import { test, expect } from './fixtures'

test.describe('Home page', () => {
  test('shows primary counter actions', async ({ page }) => {
    await expect(page.getByTestId('home-page')).toBeVisible()
    await expect(page.getByTestId('primary-actions')).toBeVisible()
    await expect(page.getByTestId('open-sale')).toBeVisible()
    await expect(page.getByTestId('open-purchase')).toBeVisible()
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
  test('New Sale navigates to the Sale screen', async ({ page }) => {
    await page.getByTestId('open-sale').click()
    await expect(page.getByTestId('sale-page')).toBeVisible()
    // Transaction screens share the hub chrome — Back returns to the hub.
    await page.getByTestId('back-button').click()
    await expect(page.getByTestId('home-page')).toBeVisible()
  })

  test('management link navigates to Product Master in the hub', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()
    await expect(page.getByTestId('product-master-page')).toBeVisible()
  })

  test('Back button returns to the hub from a sub-page', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()
    await expect(page.getByTestId('product-master-page')).toBeVisible()

    await page.getByTestId('back-button').click()
    await expect(page.getByTestId('home-page')).toBeVisible()
  })
})

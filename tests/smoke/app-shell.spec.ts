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
  test('New Sale opens a standalone Sale window', async ({ electronApp, page }) => {
    const [sale] = await Promise.all([
      electronApp.waitForEvent('window'),
      page.getByTestId('open-sale').click()
    ])
    await sale.waitForLoadState('domcontentloaded')
    await expect(sale.getByTestId('sale-page')).toBeVisible()
    // A transaction window carries a Cancel (close) control, not the hub chrome.
    await expect(sale.getByTestId('cancel-window')).toBeVisible()
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

import { test, expect } from './fixtures'

test.describe('Product Master', () => {
  test('page loads with empty state', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()
    await expect(page.getByTestId('product-master-page')).toBeVisible()
    await expect(page.getByText('0 products')).toBeVisible()
    await expect(page.getByText('No products yet')).toBeVisible()
  })

  test('add a bulk product via dialog', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()
    await page.getByTestId('add-product-btn').click()
    await expect(page.getByTestId('product-dialog')).toBeVisible()

    await page.getByTestId('product-name-input').fill('Toor Dal Premium')
    await page.getByTestId('product-group-combobox').fill('Toor Dal')

    // Type defaults to 'bulk', select bag size
    await page.getByTestId('product-bag-size-select').click()
    await page.getByRole('option', { name: '50 kg' }).click()

    await page.getByTestId('product-submit').click()
    await expect(page.getByTestId('product-dialog')).not.toBeVisible()
    await expect(page.getByText('1 product')).toBeVisible()
    await expect(page.getByText('Toor Dal Premium')).toBeVisible()
  })

  test('add a packaged product via dialog', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()
    await page.getByTestId('add-product-btn').click()

    await page.getByTestId('product-name-input').fill('Atta 1kg Pack')
    await page.getByTestId('product-group-combobox').fill('Flour')

    // Switch to packaged
    await page.getByTestId('product-type-select').click()
    await page.getByRole('option', { name: 'Packaged' }).click()

    await page.getByTestId('product-submit').click()
    await expect(page.getByTestId('product-dialog')).not.toBeVisible()
    await expect(page.getByText('1 product')).toBeVisible()
  })

  test('edit a product — type and bag size shown as read-only', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()

    // Create
    await page.getByTestId('add-product-btn').click()
    await page.getByTestId('product-name-input').fill('Chana Dal Regular')
    await page.getByTestId('product-group-combobox').fill('Chana Dal')
    await page.getByTestId('product-bag-size-select').click()
    await page.getByRole('option', { name: '25 kg' }).click()
    await page.getByTestId('product-submit').click()
    await expect(page.getByTestId('product-dialog')).not.toBeVisible()

    // Edit
    await page.getByTestId('edit-product-btn').click()
    await expect(page.getByTestId('product-dialog')).toBeVisible()
    await expect(page.getByText('(cannot be changed)').first()).toBeVisible()
    await page.getByTestId('product-name-input').fill('Chana Dal Premium')
    await page.getByTestId('product-submit').click()
    await expect(page.getByTestId('product-dialog')).not.toBeVisible()
    await expect(page.getByText('Chana Dal Premium')).toBeVisible()
  })

  test('delete a product', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Product Master').click()

    // Create
    await page.getByTestId('add-product-btn').click()
    await page.getByTestId('product-name-input').fill('To Delete Product')
    await page.getByTestId('product-group-combobox').fill('Test')
    await page.getByTestId('product-bag-size-select').click()
    await page.getByRole('option', { name: '30 kg' }).click()
    await page.getByTestId('product-submit').click()
    await expect(page.getByText('1 product')).toBeVisible()

    // Delete
    await page.getByTestId('delete-product-btn').click()
    await expect(page.getByText('0 products')).toBeVisible()
  })

  test('Default Bag Size follows Settings catalog (add 40 kg then create product)', async ({
    page
  }) => {
    test.setTimeout(60_000)

    const openManagement = async (name: string): Promise<void> => {
      await page
        .getByTestId('management-links')
        .getByRole('link', { name: new RegExp(`^${name}`) })
        .click()
    }
    const goHome = async (): Promise<void> => {
      await page.getByRole('link', { name: /^Vajra$/ }).click()
      await expect(page.getByTestId('home-page')).toBeVisible()
    }

    // Seed catalog has 25/30/50 only — 40 kg not offered yet
    await openManagement('Product Master')
    await page.getByTestId('add-product-btn').click()
    await page.getByTestId('product-bag-size-select').click()
    await expect(page.getByRole('option', { name: '40 kg' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Add 40 kg Default Bag Type in Settings
    await goHome()
    await openManagement('Settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.getByTestId('bag-type-row')).toHaveCount(3)
    await page.getByTestId('new-bag-size').fill('40')
    await page.getByTestId('new-bag-loading').fill('0')
    await page.getByTestId('add-bag-type').click()
    await expect(page.getByTestId('bag-type-row')).toHaveCount(4)
    await page.getByTestId('settings-save').click()
    await expect(page.getByTestId('settings-saved')).toBeVisible()

    // Product create now offers 40 kg and persists it
    await goHome()
    await openManagement('Product Master')
    await page.getByTestId('add-product-btn').click()
    await page.getByTestId('product-name-input').fill('Forty Kg Dal')
    await page.getByTestId('product-group-combobox').fill('Dal')
    await page.getByTestId('product-bag-size-select').click()
    await page.getByRole('option', { name: '40 kg' }).click()
    await page.getByTestId('product-submit').click()
    await expect(page.getByTestId('product-dialog')).not.toBeVisible()
    await expect(page.getByText('Forty Kg Dal')).toBeVisible()
    await expect(page.getByText('40 kg')).toBeVisible()

    // Remove of in-use 40 kg is blocked
    await goHome()
    await openManagement('Settings')
    await page.getByTestId('bag-type-remove-40').click()
    await expect(page.getByTestId('bag-type-error')).toContainText('Default Bag Size')
    await expect(page.getByTestId('bag-type-row')).toHaveCount(4)
  })
})

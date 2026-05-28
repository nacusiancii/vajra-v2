import { test, expect } from './fixtures'

test.describe('Customer Master', () => {
  test('page loads with empty state', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Customer Master').click()
    await expect(page.getByTestId('customer-master-page')).toBeVisible()
    await expect(page.getByText('0 customers')).toBeVisible()
    await expect(page.getByText('No customers yet')).toBeVisible()
  })

  test('add a customer via dialog', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Customer Master').click()
    await page.getByTestId('add-customer-btn').click()
    await expect(page.getByTestId('customer-dialog')).toBeVisible()

    await page.getByTestId('customer-name-input').fill('Ravi Kumar')
    await page.getByTestId('customer-place-combobox').fill('Guntur')

    await page.getByTestId('customer-submit').click()
    await expect(page.getByTestId('customer-dialog')).not.toBeVisible()
    await expect(page.getByText('1 customer')).toBeVisible()
    await expect(page.getByText('Ravi Kumar')).toBeVisible()
  })

  test('edit a customer', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Customer Master').click()

    // Create
    await page.getByTestId('add-customer-btn').click()
    await page.getByTestId('customer-name-input').fill('Suresh Babu')
    await page.getByTestId('customer-place-combobox').fill('Vijayawada')
    await page.getByTestId('customer-submit').click()
    await expect(page.getByTestId('customer-dialog')).not.toBeVisible()

    // Edit
    await page.getByTestId('edit-customer-btn').click()
    await expect(page.getByTestId('customer-dialog')).toBeVisible()
    await page.getByTestId('customer-phone-input').fill('9876543210')
    await page.getByTestId('customer-submit').click()
    await expect(page.getByTestId('customer-dialog')).not.toBeVisible()
  })

  test('delete a customer', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Customer Master').click()

    // Create
    await page.getByTestId('add-customer-btn').click()
    await page.getByTestId('customer-name-input').fill('To Delete')
    await page.getByTestId('customer-place-combobox').fill('Tenali')
    await page.getByTestId('customer-submit').click()
    await expect(page.getByText('1 customer')).toBeVisible()

    // Delete
    await page.getByTestId('delete-customer-btn').click()
    await expect(page.getByText('0 customers')).toBeVisible()
  })

  test('search filters customers by name', async ({ page }) => {
    await page.getByTestId('management-links').getByText('Customer Master').click()

    // Create two customers
    await page.getByTestId('add-customer-btn').click()
    await page.getByTestId('customer-name-input').fill('Ravi Kumar')
    await page.getByTestId('customer-place-combobox').fill('Guntur')
    await page.getByTestId('customer-submit').click()
    await expect(page.getByTestId('customer-dialog')).not.toBeVisible()

    await page.getByTestId('add-customer-btn').click()
    await page.getByTestId('customer-name-input').fill('Suresh Babu')
    await page.getByTestId('customer-place-combobox').fill('Vijayawada')
    await page.getByTestId('customer-submit').click()
    await expect(page.getByText('2 customers')).toBeVisible()

    // Search
    await page.getByTestId('customer-search').fill('Ravi')
    const rows = page.getByTestId('customer-row')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Ravi Kumar')
  })
})

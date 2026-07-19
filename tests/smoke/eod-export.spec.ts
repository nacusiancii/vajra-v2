import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Short transactional day → Export Report from Rollover writes a real .xlsx
 * under the silent export folder (main process fs). Does not approve rollover.
 *
 * Catalog + purchase + sale seeding mirrors transactional-core; this file stays
 * dedicated so the longer rollover narrative is not bloated with export I/O.
 *
 * Electron note: export is no longer a browser download. Main writes under
 * VAJRA_EOD_EXPORT_DIR (set by the smoke fixture to a temp tree).
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

async function seedProduct(page: Page): Promise<void> {
  await openManagement(page, 'Product Master')
  await page.getByTestId('add-product-btn').click()
  await page.getByTestId('product-name-input').fill('Toor Dal')
  await page.getByTestId('product-group-combobox').fill('Dal')
  await page.getByTestId('product-bag-size-select').click()
  await page.getByRole('option', { name: '50 kg' }).click()
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

async function creditPurchase(page: Page): Promise<void> {
  await page.getByTestId('open-credit-purchase').click()
  await expect(page.getByTestId('purchase-page')).toHaveAttribute('data-mode', 'credit')
  await dismissAutoPicker(page)
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('5')
  await page.getByTestId('purchase-finish').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

async function cashSale(page: Page): Promise<void> {
  await page.getByTestId('open-cash-sale').click()
  await expect(page.getByTestId('sale-page')).toHaveAttribute('data-mode', 'cash')
  await page.getByTestId('sale-walkin-name').fill('Export Customer')
  await page.getByTestId('cart-product').click()
  await page.getByRole('option', { name: 'Toor Dal' }).click()
  await page.getByTestId('cart-rate').fill('6000')
  await page.getByTestId('cart-qty').fill('1')
  await page.getByTestId('sale-finish').click()
  await expect(page.getByTestId('slip-preview')).toBeVisible()
  await page.getByTestId('slip-done').click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

/** First completed `*_eod_report.xlsx` in dir, or null while still writing/empty. */
function findEodXlsx(dir: string): string | null {
  if (!fs.existsSync(dir)) return null
  for (const name of fs.readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_eod_report\.xlsx$/.test(name)) continue
    const full = path.join(dir, name)
    try {
      if (fs.statSync(full).size > 0) return name
    } catch {
      // File may still be mid-write.
    }
  }
  return null
}

test('Rollover Export Report writes *_eod_report.xlsx with expected sheets', async ({
  page,
  electronApp
}) => {
  // Seed path is shorter than full transactional-core; still needs headroom for Electron.
  test.setTimeout(60_000)

  const exportDir = await electronApp.evaluate(() => process.env.VAJRA_EOD_EXPORT_DIR)
  expect(exportDir, 'smoke fixture must set VAJRA_EOD_EXPORT_DIR').toBeTruthy()

  await seedProduct(page)
  await creditPurchase(page)
  await cashSale(page)

  await openManagement(page, 'Rollover')
  await expect(page.getByTestId('rollover-page')).toBeVisible()
  await expect(page.getByTestId('eod-export')).toBeVisible()

  await page.getByTestId('eod-export').click()

  await expect
    .poll(() => findEodXlsx(exportDir as string), { timeout: 15_000 })
    .toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_eod_report\.xlsx$/)

  const fileName = findEodXlsx(exportDir as string)
  expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_eod_report\.xlsx$/)
  const filePath = path.join(exportDir as string, fileName as string)

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const sheetNames = wb.worksheets.map((ws) => ws.name)
  expect(sheetNames).toEqual(
    expect.arrayContaining(['Summary', 'Inventory', 'Transactions', 'Audit'])
  )

  // Toast confirms silent write (folder name VajraExports under temp userData).
  const toast = page.getByTestId('toast')
  await expect(toast).toBeVisible()
  await expect(toast).toHaveAttribute('data-toast-kind', 'success')
  await expect(toast).toContainText(/Exported to/i)
})

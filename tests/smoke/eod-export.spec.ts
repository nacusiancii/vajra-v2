import { test, expect, dismissAutoPicker } from './fixtures'
import type { Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Short transactional day → Export Report from Rollover produces a real .xlsx.
 * Does not approve rollover — export must work before that step.
 *
 * Catalog + purchase + sale seeding mirrors transactional-core; this file stays
 * dedicated so the longer rollover narrative is not bloated with download I/O.
 *
 * Electron note: the renderer saves via a blob URL + synthetic `<a download>`.
 * That path does not fire Playwright's page `download` event under Electron.
 * We capture via the main-process `session.will-download` hook and a known
 * save directory under the test temp tree.
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

/** First completed `vajra-eod-*.xlsx` in dir, or null while still writing/empty. */
function findEodXlsx(dir: string): string | null {
  if (!fs.existsSync(dir)) return null
  for (const name of fs.readdirSync(dir)) {
    if (!/^vajra-eod-.+\.xlsx$/.test(name)) continue
    const full = path.join(dir, name)
    try {
      if (fs.statSync(full).size > 0) return name
    } catch {
      // File may still be mid-write.
    }
  }
  return null
}

test('Rollover Export Report downloads vajra-eod-*.xlsx with expected sheets', async ({
  page,
  electronApp
}) => {
  // Seed path is shorter than full transactional-core; still needs headroom for Electron.
  test.setTimeout(60_000)

  await seedProduct(page)
  await creditPurchase(page)
  await cashSale(page)

  await openManagement(page, 'Rollover')
  await expect(page.getByTestId('rollover-page')).toBeVisible()
  await expect(page.getByTestId('eod-export')).toBeVisible()

  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vajra-eod-export-'))
  try {
    // Route Electron's download to a known directory (no save dialog in CI).
    await electronApp.evaluate(({ session }, dir: string) => {
      session.defaultSession.once('will-download', (_event, item) => {
        // dir is an absolute temp path from the test process; filename comes from
        // a.download = vajra-eod-YYYY-MM-DD.xlsx on the renderer side.
        item.setSavePath(`${dir}/${item.getFilename()}`)
      })
    }, downloadDir)

    await page.getByTestId('eod-export').click()

    await expect
      .poll(() => findEodXlsx(downloadDir), { timeout: 15_000 })
      .toMatch(/^vajra-eod-.+\.xlsx$/)

    const fileName = findEodXlsx(downloadDir)
    expect(fileName).toMatch(/^vajra-eod-.+\.xlsx$/)
    const filePath = path.join(downloadDir, fileName as string)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath)
    const sheetNames = wb.worksheets.map((ws) => ws.name)
    expect(sheetNames).toEqual(
      expect.arrayContaining(['Summary', 'Inventory', 'Transactions', 'Audit'])
    )
  } finally {
    fs.rmSync(downloadDir, { recursive: true, force: true })
  }
})

import { expect, type Page } from '@playwright/test'

/**
 * Shared UI-driving helpers for the smoke suite.
 *
 * `fixtures.ts` owns launching Electron; this file owns the handful of steps
 * nearly every counter flow repeats before the interesting part starts
 * (go Home, open a management card, seed a product or customer). One copy here
 * means one place to fix when the UI shifts.
 */

/** Click the Vajra brand link and wait for Home to render. */
export async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Vajra$/ }).click()
  await expect(page.getByTestId('home-page')).toBeVisible()
}

/** Open a management card by its heading (the card's accessible name starts with it). */
export async function openManagement(page: Page, name: string): Promise<void> {
  await page
    .getByTestId('management-links')
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .click()
}

export type SeedProductOptions = {
  name: string
  /** Product Group. Defaults to `Dal`. */
  group?: string
  /** Bag-size option label as shown in the select. Defaults to `50 kg`. */
  bagSize?: string
  /** Telugu product name for customer-facing slips (ADR-0003). */
  nameTe?: string
}

/** Add a Bulk product in Product Master from Home and return to Home. */
export async function seedProduct(page: Page, opts: SeedProductOptions): Promise<void> {
  const { name, group = 'Dal', bagSize = '50 kg', nameTe } = opts
  await openManagement(page, 'Product Master')
  await page.getByTestId('add-product-btn').click()
  await expect(page.getByTestId('product-dialog')).toBeVisible()
  await page.getByTestId('product-name-input').fill(name)
  await page.getByTestId('product-group-combobox').fill(group)
  // Wait for the bag-size control to settle after group combobox layout.
  const bagSizeSelect = page.getByTestId('product-bag-size-select')
  await expect(bagSizeSelect).toBeVisible()
  await bagSizeSelect.click()
  await page.getByRole('option', { name: bagSize }).click()
  if (nameTe) {
    await page.getByTestId('product-name-te-input').fill(nameTe)
  }
  await page.getByTestId('product-submit').click()
  await expect(page.getByTestId('product-dialog')).not.toBeVisible()
  await goHome(page)
}

export type SeedCustomerOptions = {
  name: string
  place: string
  /** Credit Sales require a phone; omit for walk-in-style customers. */
  phone?: string
  /** Telugu name/place for customer-facing slips (ADR-0003). */
  nameTe?: string
  placeTe?: string
}

/** Add a customer in Customer Master from Home and return to Home. */
export async function seedCustomer(page: Page, opts: SeedCustomerOptions): Promise<void> {
  const { name, place, phone, nameTe, placeTe } = opts
  await openManagement(page, 'Customer Master')
  await page.getByTestId('add-customer-btn').click()
  await expect(page.getByTestId('customer-dialog')).toBeVisible()
  await page.getByTestId('customer-name-input').fill(name)
  await page.getByTestId('customer-place-combobox').fill(place)
  if (phone) {
    await page.getByTestId('customer-phone-input').fill(phone)
  }
  if (nameTe) {
    await page.getByTestId('customer-name-te-input').fill(nameTe)
  }
  if (placeTe) {
    await page.getByTestId('customer-place-te-input').fill(placeTe)
  }
  await page.getByTestId('customer-submit').click()
  await expect(page.getByTestId('customer-dialog')).not.toBeVisible()
  await expect(page.getByTestId('customer-row').filter({ hasText: name })).toBeVisible()
  await goHome(page)
}

/**
 * Dismiss an auto-opened EntityCombobox list and wait until its layer is gone.
 *
 * Two races to close:
 * 1. Auto-focus open is scheduled on nextTick. Escaping before the portal mounts
 *    is a no-op; openFilter then opens after this helper returns, so a follow-up
 *    input click races an exit animation ("element is not stable" / detached).
 * 2. Escape starts reka-ui's close animation. The search placeholder now lives
 *    on the always-visible input, so it is not a settle signal — wait for
 *    `[data-slot="popover-content"]` to detach fully (not a sleep).
 *
 * Wait for the layer to appear, Escape, then for full detach of the popover.
 */
export async function dismissAutoPicker(page: Page): Promise<void> {
  const content = page.locator('[data-slot="popover-content"]')
  // Auto-open must finish before Escape is meaningful.
  await expect(content).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(content).toHaveCount(0)
}

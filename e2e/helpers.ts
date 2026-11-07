import { expect, type Page } from '@playwright/test'

export const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin'
const BOOTSTRAP_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin'

// The E2E stack sets WOMBAT_FORCE_PASSWORD_ROTATION=false. The rotation path
// below keeps the suite usable against a stack that does force it.
let currentPassword = BOOTSTRAP_PASSWORD

export async function login(page: Page): Promise<void> {
  await page.goto('/#/login')
  // The login form also has an optional Company ID text input, so target the
  // username by its autocomplete attribute rather than by type alone.
  await page.locator('input[autocomplete="username"]').waitFor()
  await page.locator('input[autocomplete="username"]').fill(ADMIN_USER)
  await page.locator('input[type="password"]').fill(currentPassword)
  await page.locator('button[type="submit"]').click()

  const rotationHeading = page.getByRole('heading', { name: /choose a new password/i })
  if (await rotationHeading.isVisible().catch(() => false)) {
    const newPassword = 'E2e-Password-123!'
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill(currentPassword)
    await inputs.nth(1).fill(newPassword)
    await inputs.nth(2).fill(newPassword)
    await page.getByRole('button', { name: /update password/i }).click()
    currentPassword = newPassword
  }

  // Any password field left on screen means we are still on login/rotation.
  await expect(page.locator('input[type="password"]')).toHaveCount(0, { timeout: 20_000 })
}

export async function csrfToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  return cookies.find(cookie => cookie.name === 'wombat_csrf')?.value ?? ''
}

import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('session uses HttpOnly cookies and stores no tokens', async ({ page }) => {
  await login(page)

  const storage = await page.evaluate(() => ({ ...localStorage }))
  expect(storage.wombat_access_token).toBeUndefined()
  expect(storage.wombat_refresh_token).toBeUndefined()

  const cookies = await page.context().cookies()
  const access = cookies.find(cookie => cookie.name === 'wombat_access')
  const refresh = cookies.find(cookie => cookie.name === 'wombat_refresh')
  const csrf = cookies.find(cookie => cookie.name === 'wombat_csrf')

  expect(access?.httpOnly).toBe(true)
  expect(refresh?.httpOnly).toBe(true)
  expect(csrf?.httpOnly).toBe(false)
})

test('logout clears the session', async ({ page }) => {
  await login(page)
  // The sign-out action lives in the account menu, not the top-level nav.
  await page.getByRole('button', { name: 'Administrator' }).click()
  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15_000 })
})

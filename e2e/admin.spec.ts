import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('admin user management is reachable', async ({ page }) => {
  await login(page)
  await page.goto('/#/users')
  await expect(page.locator('h1').first()).toBeAttached({ timeout: 20_000 })
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
})

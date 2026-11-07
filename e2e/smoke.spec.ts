import { expect, test } from '@playwright/test'
import { login } from './helpers'

const ROUTES = ['dashboard', 'findings', 'runs', 'catalogue', 'settings', 'security', 'audit']

test('core pages render for an authenticated admin', async ({ page }) => {
  await login(page)
  for (const route of ROUTES) {
    await page.goto(`/#/${route}`)
    await expect(page.locator('h1').first()).toBeAttached({ timeout: 20_000 })
  }
})

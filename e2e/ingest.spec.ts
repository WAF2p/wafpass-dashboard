import { expect, test } from '@playwright/test'
import { csrfToken, login } from './helpers'

test('demo run is ingested and appears in the runs list', async ({ page }) => {
  await login(page)
  const token = await csrfToken(page)
  expect(token).not.toBe('')

  const response = await page.request.post('/api/v1/sandbox/demo-run', {
    headers: { 'X-CSRF-Token': token },
  })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  const project = body?.data?.project as string | undefined
  expect(project).toBeTruthy()

  // The run list is loaded once on app mount; reload so the new run is part
  // of the fetch rather than relying on a hash-only navigation.
  await page.goto('/#/runs')
  await page.reload()
  await expect(page.getByText(project!, { exact: false }).first()).toBeVisible({ timeout: 25_000 })
})

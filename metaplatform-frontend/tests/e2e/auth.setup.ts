import { test as setup, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

const AUTH_FILE = 'tests/e2e/.auth/state.json';

setup('authenticate', async ({ page, request }) => {
  await loginViaApi(page, request);

  // Warm up to ensure localStorage write committed.
  await page.goto('/');
  await expect(page).toHaveURL(/\/(login|agents|dw|portal|$)/);

  await page.context().storageState({ path: AUTH_FILE });
});

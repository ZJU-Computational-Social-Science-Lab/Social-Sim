/**
 * E2E test fixture with authentication and locale pre-configured.
 *
 * Logs in through the UI to establish a real session, then sets
 * the language preference. This is more reliable than injecting
 * tokens into localStorage.
 *
 * Credentials: E2E_EMAIL / E2E_PASSWORD env vars
 *   (defaults: test@test.com.cn / test)
 * Language key: fos.lang
 *
 * Exports: test, expect
 */

import { test as base, expect } from '@playwright/test';

type E2EFixtures = {
  authedPage: void;
  locale: string;
};

export const test = base.extend<E2EFixtures>({
  locale: ['en', { option: true }],
  authedPage: async ({ page, locale }, use) => {
    const email = process.env.E2E_EMAIL || 'test@test.com.cn';
    const password = process.env.E2E_PASSWORD || 'test';

    // Set language preference before any navigation
    await page.addInitScript((lang) => {
      localStorage.setItem('fos.lang', lang);
    }, locale);

    // Navigate to login page and log in through the UI
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for redirect after successful login (dashboard or wherever)
    await page.waitForURL(/\/(dashboard|simulations)/, { timeout: 60_000 });

    await use();
  },
});

export { expect };

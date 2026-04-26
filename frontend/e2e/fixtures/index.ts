/**
 * E2E test fixture with authentication and locale pre-configured.
 *
 * Injects JWT tokens and language preference into localStorage
 * to bypass login and set the UI language. Keeps health-check
 * tests focused on the experiment builder flow.
 *
 * Auth keys: fos.access, fos.refresh, fos.user
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
    // Navigate to any page to set localStorage
    await page.goto('/');

    const accessToken = process.env.E2E_ACCESS_TOKEN || '';
    const refreshToken = process.env.E2E_REFRESH_TOKEN || '';
    const userJson = process.env.E2E_USER_JSON || '{}';

    if (!accessToken) {
      throw new Error(
        'E2E_ACCESS_TOKEN env var is required. Get one by logging in via the UI ' +
        'and copying fos.access from localStorage.'
      );
    }

    await page.evaluate(
      ({ access, refresh, user, lang }) => {
        localStorage.setItem('fos.access', access);
        localStorage.setItem('fos.refresh', refresh);
        localStorage.setItem('fos.user', user);
        localStorage.setItem('fos.lang', lang);
      },
      { access: accessToken, refresh: refreshToken, user: userJson, lang: locale }
    );

    await use();
  },
});

export { expect };

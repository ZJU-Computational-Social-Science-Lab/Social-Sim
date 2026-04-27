/**
 * Playwright configuration for E2E health-check runner.
 *
 * Runs all 13 scenarios in two languages (English, Chinese) sequentially
 * with long timeouts for LLM calls. No retries — we want to see failures
 * as-is for diagnostics.
 *
 * Exports: default (Playwright config)
 */

import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  globalSetup: resolve(__dirname, 'e2e/global-setup.ts'),
  testDir: './e2e',
  fullyParallel: false,        // Sequential — LLM backend can't handle parallel
  retries: 0,                  // No retries — see failures as-is
  timeout: 300_000,            // 5 min per scenario (LLM × N agents × 3 rounds)
  expect: {
    timeout: 30_000,
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/collected-results/playwright-report.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'en',
      use: {
        browserName: 'chromium',
        locale: 'en',
      },
    },
    {
      name: 'zh',
      use: {
        browserName: 'chromium',
        locale: 'zh',
      },
    },
  ],
});

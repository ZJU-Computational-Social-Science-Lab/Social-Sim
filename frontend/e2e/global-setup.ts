/**
 * Global setup for E2E health-check tests.
 *
 * Verifies that frontend and backend services are reachable
 * before any test runs. Fails fast with clear error messages
 * if services are not running.
 *
 * Exports: default (global setup function)
 */

import { request as playwrightRequest } from '@playwright/test';

async function globalSetup() {
  const api = await playwrightRequest.newContext({
    baseURL: 'http://127.0.0.1:5173',
  });

  // Verify frontend is reachable
  const frontendResp = await api.get('/');
  if (!frontendResp.ok() && frontendResp.status() !== 200) {
    throw new Error(
      'Frontend not running on http://127.0.0.1:5173. Start with: cd frontend && npm run dev'
    );
  }

  // Verify backend API is reachable (scenarios endpoint)
  const backendResp = await api.get('/api/scenarios');
  if (!backendResp.ok()) {
    throw new Error(
      'Backend API not reachable. Start the backend server first.'
    );
  }

  await api.dispose();
}

export default globalSetup;

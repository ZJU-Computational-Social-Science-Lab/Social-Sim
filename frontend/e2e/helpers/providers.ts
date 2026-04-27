/**
 * Dynamic LLM provider resolver for E2E health-check tests.
 *
 * Fetches the current user's active providers from the API at runtime
 * and returns a random assignment for N agents. Falls back to undefined
 * if no providers are available (the builder silently skips provider
 * assignment in that case).
 *
 * This makes tests portable — no hardcoded database IDs needed.
 *
 * Exports: resolveProviderIds
 */

import { Page } from '@playwright/test';

interface ProviderInfo {
  id: number;
  is_active: boolean;
}

/**
 * Fetch active providers from the API and return N random provider IDs.
 *
 * Uses the page's existing auth session (cookies/localStorage) to call
 * GET /api/providers. Returns a shuffled selection with repetition if
 * fewer providers than agents are available.
 *
 * @param page - Playwright page with auth session
 * @param agentCount - Number of agents to assign providers to
 * @returns Array of provider IDs, or undefined if no providers found
 */
export async function resolveProviderIds(
  page: Page,
  agentCount: number,
): Promise<number[] | undefined> {
  const providers: ProviderInfo[] = await page.evaluate(async () => {
    const resp = await fetch('/api/providers');
    if (!resp.ok) return [];
    return resp.json();
  });

  const active = providers.filter(p => p.is_active).map(p => p.id);

  if (active.length === 0) return undefined;

  // Shuffle and assign (with repetition if fewer providers than agents)
  const ids: number[] = [];
  for (let i = 0; i < agentCount; i++) {
    ids.push(active[Math.floor(Math.random() * active.length)]);
  }
  return ids;
}

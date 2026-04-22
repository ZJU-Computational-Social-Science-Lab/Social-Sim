/**
 * Scenario localization utilities for frontend.
 */

/**
 * Get the localized name for a scenario.
 *
 * @param t - Translation function
 * @param scenarioData - Scenario data object
 * @returns Localized scenario name or null if not available
 */
export function getLocalizedScenarioName(
  t: (key: string) => string,
  scenarioData: { name?: string; id?: string } | null
): string | null {
  if (!scenarioData) {
    return null;
  }

  // For now, just return the name from the scenario data
  // In the future, this could look up localized names using t()
  return scenarioData.name || null;
}
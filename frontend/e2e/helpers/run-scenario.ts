/**
 * Scenario runner helper for E2E health-check tests.
 *
 * Orchestrates the full flow for a single scenario: create simulation,
 * run rounds, collect errors, and gather test_results/ files.
 * Never throws — all errors are caught and recorded.
 *
 * Exports: runScenario, ScenarioResult
 */

import { Page } from '@playwright/test';
import { ExperimentBuilder } from './experiment-builder';
import { SimulationWorkspace } from './simulation-workspace';
import { ResultCollector } from './result-collector';
import { resolveProviderIds } from './providers';
import { ScenarioConfig } from '../fixtures/scenario-fixtures';

export interface ScenarioResult {
  id: string;
  name: string;
  locale: 'en' | 'zh';
  status: 'passed' | 'ui_errors' | 'crashed' | 'timeout' | 'unknown';
  uiErrors: string[];
  warnings: string[];
  testResultFiles: string[];
  durationMs: number;
}

export async function runScenario(
  page: Page,
  scenario: ScenarioConfig,
  locale: string,
): Promise<ScenarioResult> {
  const result: ScenarioResult = {
    id: scenario.id,
    name: scenario.name,
    locale: locale as 'en' | 'zh',
    status: 'unknown',
    uiErrors: [],
    warnings: [],
    testResultFiles: [],
    durationMs: 0,
  };

  const collector = new ResultCollector(scenario.id);
  const start = Date.now();

  try {
    const builder = new ExperimentBuilder(page, locale);

    // Resolve providers dynamically from the API (portable across systems)
    const providerIds = await resolveProviderIds(page, scenario.agentNames.length);

    await builder.createSimulationWithDefaults(
      scenario.id,
      scenario.agentNames,
      scenario.agentRolePrompts,
      scenario.zhAgentRolePrompts,
      scenario.parameters,
      providerIds,
    );

    const workspace = new SimulationWorkspace(page, locale);
    await workspace.waitForReady();

    // Collect any UI error toasts before advancing
    result.uiErrors.push(...await workspace.collectErrorMessages());

    // Run the simulation rounds
    const advanceErrors = await workspace.advanceRounds(scenario.rounds);
    result.warnings.push(...advanceErrors);

    // Collect errors again after running
    result.uiErrors.push(...await workspace.collectErrorMessages());

    result.status = result.uiErrors.length === 0 ? 'passed' : 'ui_errors';
  } catch (err) {
    result.status = 'crashed';
    result.uiErrors.push(String(err));
  }

  // Always try to collect test_results/ files
  try {
    result.testResultFiles = collector.collect();
  } catch (collectErr) {
    result.warnings.push(`Failed to collect test_results: ${String(collectErr)}`);
  }

  result.durationMs = Date.now() - start;
  return result;
}

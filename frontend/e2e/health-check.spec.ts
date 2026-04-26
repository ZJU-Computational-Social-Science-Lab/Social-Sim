/**
 * E2E health-check orchestrator for all 13 simulation scenarios.
 *
 * Runs each scenario in both English and Chinese through the experiment
 * builder, auto-advances rounds, collects UI errors and test_results/
 * debug logs. Never hard-fails — the diagnostic report is the output.
 *
 * Output: frontend/e2e/collected-results/run-report-{en,zh}.json
 *
 * Scenarios: prisoners_dilemma, battle_of_the_sexes, stag_hunt,
 *            public_goods, coordination_game, open_discussion,
 *            council_chamber, grid_world, contagion,
 *            social_norm_disruption, policy_erosion, echo_chamber,
 *            resource_scarcity
 */

import { test, expect } from './fixtures';
import { getAllScenarios } from './fixtures/scenario-fixtures';
import { runScenario, ScenarioResult } from './helpers/run-scenario';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allScenarios = getAllScenarios();
const resultsByLocale: Record<string, ScenarioResult[]> = { en: [], zh: [] };

for (const scenario of allScenarios) {
  test(`health-check (${scenario.name})`, async ({ page, authedPage, locale }) => {
    const result = await runScenario(page, scenario, locale);

    if (!resultsByLocale[locale]) {
      resultsByLocale[locale] = [];
    }
    resultsByLocale[locale].push(result);

    console.log(
      `[${locale}] [${scenario.id}] status=${result.status} ` +
      `ui_errors=${result.uiErrors.length} ` +
      `duration=${result.durationMs}ms`
    );
  });
}

test.afterAll(async () => {
  const outputDir = path.resolve(__dirname, 'collected-results');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [locale, results] of Object.entries(resultsByLocale)) {
    if (results.length === 0) continue;

    const outputPath = path.join(outputDir, `run-report-${locale}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`\nHealth check (${locale}) complete. Report: ${outputPath}`);

    for (const r of results) {
      const icon = r.status === 'passed' ? 'OK' : r.status === 'ui_errors' ? 'WARN' : 'FAIL';
      console.log(`  [${icon}] ${r.name} (${r.status}) — ${r.durationMs}ms`);
    }

    const passed = results.filter(r => r.status === 'passed').length;
    console.log(`\n${passed}/${results.length} scenarios passed (${locale}).`);
  }
});

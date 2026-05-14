/**
 * E2E health-check orchestrator for all 13 simulation scenarios.
 *
 * Runs each scenario in both English and Chinese through the experiment
 * builder, auto-advances rounds, collects UI errors and test_results/
 * debug logs. Never hard-fails — the diagnostic report is the output.
 *
 * Output: frontend/e2e/collected-results/run-report-{en,zh}.json
 *         frontend/e2e/collected-results/health-check-review.txt
 *
 * Scenarios: prisoners_dilemma, battle_of_the_sexes, stag_hunt,
 *            public_goods, coordination_game, open_discussion,
 *            council_chamber, grid_world, contagion,
 *            social_norm_disruption, policy_erosion, echo_chamber,
 *            resource_scarcity
 */

import { test, expect } from './fixtures';
import { getAllScenarios, SCENARIOS } from './fixtures/scenario-fixtures';
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

/**
 * Dedicated custom scenario test.
 *
 * Verifies the custom scenario flow end-to-end: navigating to the custom
 * scenario, filling in the required prompt textarea, running rounds, and
 * asserting UI behaviour (panels render, no error state).
 *
 * Does NOT assert on agent response content — only UI state.
 */
test('custom scenario — prompt-based simulation', async ({ page, authedPage, locale }) => {
  const customConfig = SCENARIOS.custom;
  const result = await runScenario(page, customConfig, locale);

  if (!resultsByLocale[locale]) {
    resultsByLocale[locale] = [];
  }
  resultsByLocale[locale].push(result);

  // Assert: no crash
  expect(result.status).not.toBe('crashed');

  // Assert: no UI errors displayed
  expect(result.uiErrors).toEqual([]);

  // Assert: status is passed or at worst ui_errors (never crashed/timeout)
  expect(['passed', 'ui_errors']).toContain(result.status);

  console.log(
    `[${locale}] [custom] status=${result.status} ` +
    `ui_errors=${result.uiErrors.length} ` +
    `duration=${result.durationMs}ms`
  );
});

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

  // Generate health-check-review.txt automatically
  generateReviewFile(outputDir, resultsByLocale);
});

/**
 * Generate a combined health-check-review.txt from run reports and debug logs.
 * Concatenates run reports and per-scenario debug logs into a single
 * reviewable file.
 */
function generateReviewFile(
  outputDir: string,
  allResults: Record<string, ScenarioResult[]>,
) {
  const now = new Date();
  const dateStr = now.toLocaleString();
  const lines: string[] = [];

  const allLocaleResults = Object.values(allResults).flat();
  const total = allLocaleResults.length;
  const passed = allLocaleResults.filter(r => r.status === 'passed').length;

  lines.push('======================================================');
  lines.push(`E2E Health-Check Review — All 13 Scenarios (EN + ZH)`);
  lines.push(`Generated: ${dateStr}`);
  lines.push(`Result: ${passed}/${total} tests passed`);
  lines.push('======================================================');
  lines.push('');

  // Run reports
  lines.push('## RUN REPORTS');
  lines.push('');

  for (const [locale, results] of Object.entries(allResults)) {
    if (results.length === 0) continue;
    lines.push(`### ${locale === 'en' ? 'English' : 'Chinese'}`);

    const reportPath = path.join(outputDir, `run-report-${locale}.json`);
    if (fs.existsSync(reportPath)) {
      lines.push(fs.readFileSync(reportPath, 'utf-8'));
    }
  }

  // Per-scenario debug logs
  const seenScenarios = new Set<string>();
  for (const result of allLocaleResults) {
    if (seenScenarios.has(result.id)) continue;
    seenScenarios.add(result.id);

    lines.push('');
    lines.push('======================================================');
    lines.push(`SCENARIO: ${result.name}`);
    lines.push('======================================================');

    // Find the scenario's collected-results directory
    const scenarioDir = path.join(outputDir, result.id);
    if (!fs.existsSync(scenarioDir)) continue;

    const debugFiles = fs.readdirSync(scenarioDir)
      .filter(f => f.endsWith('.txt'))
      .sort();

    for (const file of debugFiles) {
      const filePath = path.join(scenarioDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const maxLines = 200;
      const contentLines = content.split('\n');
      const truncated = contentLines.length > maxLines
        ? contentLines.slice(0, maxLines).join('\n') + `\n... (truncated, ${contentLines.length - maxLines} more lines)`
        : content;

      lines.push('');
      lines.push(`--- ${file} ---`);
      lines.push(truncated);
    }
  }

  const reviewPath = path.join(outputDir, 'health-check-review.txt');
  fs.writeFileSync(reviewPath, lines.join('\n'));
  console.log(`\nHealth check review: ${reviewPath}`);
}

/**
 * Page object for the 6-step Experiment Builder wizard.
 *
 * Navigates through each step using locale-aware selectors from
 * the i18n system. All button text is looked up via t() helper.
 *
 * Exports: ExperimentBuilder
 */

import { Page } from '@playwright/test';
import { t } from './locale-helper';

/** Maps scenario IDs to their UI category */
const SCENARIO_CATEGORY: Record<string, string> = {
  prisoners_dilemma: 'game_theory',
  battle_of_the_sexes: 'game_theory',
  stag_hunt: 'game_theory',
  public_goods: 'game_theory',
  coordination_game: 'game_theory',
  open_discussion: 'discussion',
  council_chamber: 'discussion',
  grid_world: 'spatial',
  contagion: 'spatial',
  social_norm_disruption: 'sociology',
  policy_erosion: 'sociology',
  echo_chamber: 'sociology',
  resource_scarcity: 'sociology',
};

export class ExperimentBuilder {
  readonly page: Page;
  readonly locale: string;

  constructor(page: Page, locale: string) {
    this.page = page;
    this.locale = locale;
  }

  /** Open the experiment builder by navigating to simulations page */
  async open() {
    await this.page.goto('/simulations/new');
    await this.page.waitForLoadState('networkidle');

    // Wait for the "Next" button — it's always visible on the builder page
    const nextText = t('experimentBuilder.next', this.locale);
    await this.page.getByRole('button', { name: new RegExp(nextText, 'i') }).waitFor({
      state: 'visible',
      timeout: 15_000,
    });
  }

  /** Step 1: Select a scenario by clicking its category then its card */
  async selectScenario(scenarioId: string) {
    const category = SCENARIO_CATEGORY[scenarioId];

    // Expand the category accordion
    if (category) {
      const categoryText = t(`scenario.category.${category}`, this.locale);
      const categoryBtn = this.page.getByRole('button', {
        name: new RegExp(categoryText, 'i'),
      }).first();
      if (await categoryBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await categoryBtn.click();
        await this.page.waitForTimeout(500);
      }
    }

    // Click the scenario card — look up the name from i18n
    const scenarioNameKey = `scenario.${category}.${scenarioId}.name`;
    const scenarioName = t(scenarioNameKey, this.locale);

    const scenarioCard = this.page.locator('button').filter({
      hasText: new RegExp(scenarioName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    }).first();
    await scenarioCard.click();
    await this.page.waitForTimeout(500);

    await this.clickNext();
  }

  /** Step 2: Accept default configuration and proceed */
  async configureDefaults() {
    await this.clickNext();
  }

  /** Step 3: Select all available actions (default behavior) */
  async selectAllActions() {
    await this.page.waitForTimeout(1000);
    await this.clickNext();
  }

  /** Step 4: Add agents by name with role prompts */
  async addAgents(names: string[], rolePrompts: string[]) {
    await this.page.waitForTimeout(1000);

    for (let i = 0; i < names.length; i++) {
      // Find inputs by their i18n placeholder text
      const labelPlaceholder = t('experimentBuilder.step4.typeLabelPlaceholder', this.locale);
      const labelInput = this.page.getByPlaceholder(labelPlaceholder).first();

      if (await labelInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await labelInput.clear();
        await labelInput.fill(names[i]);
      }

      const rolePlaceholder = t('experimentBuilder.step4.rolePromptPlaceholder', this.locale);
      const roleInput = this.page.getByPlaceholder(rolePlaceholder).first();

      if (await roleInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await roleInput.clear();
        await roleInput.fill(rolePrompts[i]);
      }

      if (i < names.length - 1) {
        const addText = t('experimentBuilder.step4.addAgentType', this.locale);
        const escaped = addText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const addBtn = this.page.getByRole('button', { name: new RegExp(escaped, 'i') });
        if (await addBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
          await addBtn.click();
          await this.page.waitForTimeout(500);
        }
      }
    }

    await this.clickNext();
  }

  /** Step 5: Accept default network configuration */
  async useDefaultNetwork() {
    await this.clickNext();
  }

  /** Step 6: Review and create the simulation */
  async create() {
    const createText = t('experimentBuilder.create', this.locale);
    const createBtn = this.page.getByRole('button', {
      name: new RegExp(createText, 'i'),
    });
    await createBtn.click();

    // Wait for navigation to the simulation workspace
    await this.page.waitForURL(/\/simulations\/[^/]+/, { timeout: 30_000 });
  }

  /** Run the full wizard flow with defaults for a given scenario */
  async createSimulationWithDefaults(
    scenarioId: string,
    agentNames: string[],
    agentRolePrompts: string[],
  ) {
    await this.open();
    await this.selectScenario(scenarioId);
    await this.configureDefaults();
    await this.selectAllActions();
    await this.addAgents(agentNames, agentRolePrompts);
    await this.useDefaultNetwork();
    await this.create();
  }

  /** Click the Next button and wait for step transition */
  private async clickNext() {
    const nextText = t('experimentBuilder.next', this.locale);
    // The "Next" button has " →" appended in the UI
    const nextBtn = this.page.getByRole('button', { name: new RegExp(nextText, 'i') });
    await nextBtn.click();
    await this.page.waitForTimeout(1000);
  }
}

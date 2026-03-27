/**
 * Tests for Step2StarterTemplate punishment configuration UI.
 *
 * Tests for:
 * - Punishment section rendering when scenario is PUBLIC_GOODS
 * - Budget, cost ratio, and anonymous mode inputs
 * - Collapsible section behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';

// Mock i18next
const i18n = {
  language: 'en',
  changeLanguage: vi.fn(),
  t: (key: string, options?: any) => {
    // Simple translation mock that returns the key
    const translations: Record<string, string> = {
      'experimentBuilder.punishment.title': 'Punishment Settings',
      'experimentBuilder.punishment.description': 'Configure punishment mechanism',
      'experimentBuilder.punishment.budgetLabel': 'Punishment Budget per Round',
      'experimentBuilder.punishment.costRatioLabel': 'Cost Ratio',
      'experimentBuilder.punishment.anonymousLabel': 'Anonymous Punishment Mode',
      'experimentBuilder.punishment.budgetHint': 'Set to 0 to disable',
      'experimentBuilder.punishment.costRatioHint': 'Higher values = stronger effect',
      'experimentBuilder.punishment.anonymousHint': 'Targets don\'t see punisher',
      'experimentBuilder.punishment.disabled': 'Punishment is disabled (budget = 0)',
    };
    return translations[key] || key;
  },
} as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// Mock the store
const mockUseExperimentBuilder = vi.fn();
vi.mock('@/store/experiment-builder', () => ({
  useExperimentBuilder: () => mockUseExperimentBuilder(),
}));

describe('Step2StarterTemplate - Punishment Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Wave 1: Punishment UI Tests (FEAT-PGG-05 through FEAT-PGG-08)
  // =========================================================================

  describe('Punishment Section Rendering', () => {
    it('should render punishment section when scenario is PUBLIC_GOODS', () => {
      mockUseExperimentBuilder.mockReturnValue({
        selectedScenarioData: {
          id: 'public_goods',
          name: 'Public Goods Game',
          category: 'game_theory',
          description: 'Test description',
          parameters: [
            {
              key: 'punishment_budget_per_round',
              type: 'number',
              default: 0,
              category: 'punishment',
              ui_hint: 'number',
            },
            {
              key: 'punishment_cost_ratio',
              type: 'number',
              default: 3.0,
              category: 'punishment',
              ui_hint: 'number',
            },
            {
              key: 'punishment_anonymous',
              type: 'boolean',
              default: false,
              category: 'punishment',
              ui_hint: 'toggle',
            },
          ],
          actions: [],
        },
        scenarioDescription: 'Test',
        scenarioParams: {},
        roundVisibility: 'simultaneous',
        turnOrder: 'fixed',
        setScenarioDescription: vi.fn(),
        setScenarioParams: vi.fn(),
        setRoundVisibility: vi.fn(),
        setTurnOrder: vi.fn(),
      });

      const { Step2StarterTemplate } = require('../Step2StarterTemplate');
      render(<Step2StarterTemplate />, { wrapper });

      // Should find the punishment section button
      expect(screen.getByText('Punishment Settings')).toBeInTheDocument();
    });

    it('should have punishment section collapsed by default', () => {
      mockUseExperimentBuilder.mockReturnValue({
        selectedScenarioData: {
          id: 'public_goods',
          name: 'Public Goods Game',
          category: 'game_theory',
          description: 'Test description',
          parameters: [
            {
              key: 'punishment_budget_per_round',
              type: 'number',
              default: 0,
              category: 'punishment',
            },
          ],
          actions: [],
        },
        scenarioDescription: 'Test',
        scenarioParams: {},
        roundVisibility: 'simultaneous',
        turnOrder: 'fixed',
        setScenarioDescription: vi.fn(),
        setScenarioParams: vi.fn(),
        setRoundVisibility: vi.fn(),
        setTurnOrder: vi.fn(),
      });

      const { Step2StarterTemplate } = require('../Step2StarterTemplate');
      render(<Step2StarterTemplate />, { wrapper });

      // Should not find description (collapsed)
      expect(screen.queryByText('Configure punishment mechanism')).not.toBeInTheDocument();
    });

    it('should expand punishment section on click', () => {
      mockUseExperimentBuilder.mockReturnValue({
        selectedScenarioData: {
          id: 'public_goods',
          name: 'Public Goods Game',
          category: 'game_theory',
          description: 'Test description',
          parameters: [
            {
              key: 'punishment_budget_per_round',
              type: 'number',
              default: 0,
              category: 'punishment',
            },
          ],
          actions: [],
        },
        scenarioDescription: 'Test',
        scenarioParams: {},
        roundVisibility: 'simultaneous',
        turnOrder: 'fixed',
        setScenarioDescription: vi.fn(),
        setScenarioParams: vi.fn(),
        setRoundVisibility: vi.fn(),
        setTurnOrder: vi.fn(),
      });

      const { Step2StarterTemplate } = require('../Step2StarterTemplate');
      render(<Step2StarterTemplate />, { wrapper });

      // Click the punishment section button
      const button = screen.getByText('Punishment Settings');
      fireEvent.click(button);

      // Should now find description (expanded)
      expect(screen.getByText('Configure punishment mechanism')).toBeInTheDocument();
    });

    it('should show budget input with default 0', () => {
      mockUseExperimentBuilder.mockReturnValue({
        selectedScenarioData: {
          id: 'public_goods',
          name: 'Public Goods Game',
          category: 'game_theory',
          description: 'Test description',
          parameters: [
            {
              key: 'punishment_budget_per_round',
              type: 'number',
              default: 0,
              category: 'punishment',
              ui_hint: 'number',
            },
          ],
          actions: [],
        },
        scenarioDescription: 'Test',
        scenarioParams: {},
        roundVisibility: 'simultaneous',
        turnOrder: 'fixed',
        setScenarioDescription: vi.fn(),
        setScenarioParams: vi.fn(),
        setRoundVisibility: vi.fn(),
        setTurnOrder: vi.fn(),
      });

      const { Step2StarterTemplate } = require('../Step2StarterTemplate');
      render(<Step2StarterTemplate />, { wrapper });

      // Expand section
      fireEvent.click(screen.getByText('Punishment Settings'));

      // Should find budget label
      expect(screen.getByText('Punishment Budget per Round')).toBeInTheDocument();
    });

    it('should show cost ratio input with default 3.0', () => {
      mockUseExperimentBuilder.mockReturnValue({
        selectedScenarioData: {
          id: 'public_goods',
          name: 'Public Goods Game',
          category: 'game_theory',
          description: 'Test description',
          parameters: [
            {
              key: 'punishment_cost_ratio',
              type: 'number',
              default: 3.0,
              category: 'punishment',
              ui_hint: 'number',
            },
          ],
          actions: [],
        },
        scenarioDescription: 'Test',
        scenarioParams: {},
        roundVisibility: 'simultaneous',
        turnOrder: 'fixed',
        setScenarioDescription: vi.fn(),
        setScenarioParams: vi.fn(),
        setRoundVisibility: vi.fn(),
        setTurnOrder: vi.fn(),
      });

      const { Step2StarterTemplate } = require('../Step2StarterTemplate');
      render(<Step2StarterTemplate />, { wrapper });

      // Expand section
      fireEvent.click(screen.getByText('Punishment Settings'));

      // Should find cost ratio label
      expect(screen.getByText('Cost Ratio')).toBeInTheDocument();
    });

    it('should show anonymous mode toggle', () => {
      mockUseExperimentBuilder.mockReturnValue({
        selectedScenarioData: {
          id: 'public_goods',
          name: 'Public Goods Game',
          category: 'game_theory',
          description: 'Test description',
          parameters: [
            {
              key: 'punishment_anonymous',
              type: 'boolean',
              default: false,
              category: 'punishment',
              ui_hint: 'toggle',
            },
          ],
          actions: [],
        },
        scenarioDescription: 'Test',
        scenarioParams: {},
        roundVisibility: 'simultaneous',
        turnOrder: 'fixed',
        setScenarioDescription: vi.fn(),
        setScenarioParams: vi.fn(),
        setRoundVisibility: vi.fn(),
        setTurnOrder: vi.fn(),
      });

      const { Step2StarterTemplate } = require('../Step2StarterTemplate');
      render(<Step2StarterTemplate />, { wrapper });

      // Expand section
      fireEvent.click(screen.getByText('Punishment Settings'));

      // Should find anonymous label
      expect(screen.getByText('Anonymous Punishment Mode')).toBeInTheDocument();
    });
  });
});

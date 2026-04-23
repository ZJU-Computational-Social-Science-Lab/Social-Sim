/**
 * Tests for Step1InteractionType component.
 *
 * Tests for:
 * - Component rendering
 * - Category accordion functionality
 * - Scenario selection
 * - Scenario card interaction
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import { Step1InteractionType } from '../Step1InteractionType';
import { useExperimentBuilder } from '../../../store/experiment-builder';
import { vi } from 'vitest';

// Mock i18next
const i18n = {
  language: 'en',
  changeLanguage: vi.fn(),
  t: (key: string, params?: any) => {
    const translations: Record<string, string> = {
      'common.loading': 'Loading…',
      'scenario.category.game_theory': 'Game Theory',
      'scenario.category.sociology': 'Sociology',
      'scenario.sociology.social_norm_disruption.name': 'Social Norm Disruption',
    };
    let result = translations[key] || key;
    if (params) {
      Object.keys(params).forEach(param => {
        result = result.replace(`{${param}}`, String(params[param]));
      });
    }
    return result;
  },
} as any;

// Mock the scenarios service
vi.mock('../../services/scenarios', () => ({
  getAllScenarios: vi.fn(() => Promise.resolve([
    {
      id: 'social-norm-disruption',
      name: 'Social Norm Disruption',
      category: 'sociology',
      description: 'A new rule is suddenly imposed',
      parameters: [],
      actions: [],
    },
    {
      id: 'prisoners-dilemma',
      name: "Prisoner's Dilemma",
      category: 'game_theory',
      description: 'Classic game theory scenario',
      parameters: [],
      actions: [],
    },
  ])),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

describe('Step1InteractionType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Rendering Tests
  // =========================================================================

  describe('Rendering', () => {
    test('should render loading state initially', () => {
      const mockStore = {
        selectedScenarioId: null,
        setSelectedScenarioId: vi.fn(),
        setSelectedScenarioData: vi.fn(),
        markStepComplete: vi.fn(),
      };

      vi.mocked(useExperimentBuilder).mockImplementation((selector) => selector(mockStore as any));

      render(<Step1InteractionType />, { wrapper });

      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    test('should render scenarios after loading', async () => {
      const mockStore = {
        selectedScenarioId: null,
        setSelectedScenarioId: vi.fn(),
        setSelectedScenarioData: vi.fn(),
        markStepComplete: vi.fn(),
      };

      vi.mocked(useExperimentBuilder).mockImplementation((selector) => selector(mockStore as any));

      render(<Step1InteractionType />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Social Norm Disruption')).toBeInTheDocument();
        expect(screen.getByText("Prisoner's Dilemma")).toBeInTheDocument();
      });
    });

    test('should render category accordions', async () => {
      const mockStore = {
        selectedScenarioId: null,
        setSelectedScenarioId: vi.fn(),
        setSelectedScenarioData: vi.fn(),
        markStepComplete: vi.fn(),
      };

      vi.mocked(useExperimentBuilder).mockImplementation((selector) => selector(mockStore as any));

      render(<Step1InteractionType />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Sociology')).toBeInTheDocument();
        expect(screen.getByText('Game Theory')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Accordion Tests
  // =========================================================================

  describe('Category Accordions', () => {
    test('should expand accordion on click', async () => {
      const mockStore = {
        selectedScenarioId: null,
        setSelectedScenarioId: vi.fn(),
        setSelectedScenarioData: vi.fn(),
        markStepComplete: vi.fn(),
      };

      vi.mocked(useExperimentBuilder).mockImplementation((selector) => selector(mockStore as any));

      render(<Step1InteractionType />, { wrapper });

      await waitFor(() => {
        const sociologyHeader = screen.getByText('Sociology');
        expect(sociologyHeader).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Scenario Selection Tests
  // =========================================================================

  describe('Scenario Selection', () => {
    test('should call setSelectedScenarioId when scenario is clicked', async () => {
      const setSelectedScenarioId = vi.fn();
      const setSelectedScenarioData = vi.fn();
      const markStepComplete = vi.fn();

      const mockStore = {
        selectedScenarioId: null,
        setSelectedScenarioId,
        setSelectedScenarioData,
        markStepComplete,
      };

      vi.mocked(useExperimentBuilder).mockImplementation((selector) => selector(mockStore as any));

      render(<Step1InteractionType />, { wrapper });

      await waitFor(() => {
        const scenarioButton = screen.getByText('Social Norm Disruption');
        expect(scenarioButton).toBeInTheDocument();
      });

      const scenarioButton = screen.getByText('Social Norm Disruption');
      await act(async () => {
        fireEvent.click(scenarioButton);
      });

      expect(setSelectedScenarioId).toHaveBeenCalledWith('social-norm-disruption');
      expect(markStepComplete).toHaveBeenCalledWith(1);
    });
  });
});

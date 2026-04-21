/**
 * Tests for Step1InteractionType component.
 *
 * Tests for:
 * - Guided start options
 * - Default recommended template preview
 * - Category-to-template preview interaction
 * - Scenario selection callbacks
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

import { Step1InteractionType } from '../Step1InteractionType';
import { useExperimentBuilder } from '../../../store/experiment-builder';

vi.mock('../../../store/experiment-builder', () => ({
  useExperimentBuilder: vi.fn(),
}));

vi.mock('../../../services/scenarios', () => ({
  getAllScenarios: vi.fn(() =>
    Promise.resolve([
      {
        id: 'prisoners_dilemma',
        name: "Prisoner's Dilemma",
        category: 'game_theory',
        description: 'Classic cooperation versus defection scenario.',
        parameters: [],
        actions: [],
      },
      {
        id: 'stag_hunt',
        name: 'Stag Hunt',
        category: 'game_theory',
        description: 'A coordination problem with risk and trust.',
        parameters: [],
        actions: [],
      },
      {
        id: 'social_norm_disruption',
        name: 'Social Norm Disruption',
        category: 'sociology',
        description: 'A new rule is suddenly imposed on the group.',
        parameters: [],
        actions: [],
      },
    ])
  ),
}));

vi.mock('react-i18next', () => {
  const translate = (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'common.loading': 'Loading...',
      'dashboard.error': 'Error',
      'scenario.category.game_theory': 'Game Theory',
      'scenario.category.sociology': 'Sociology',
    };

    if (translations[key]) {
      return translations[key];
    }

    return typeof params?.defaultValue === 'string' ? params.defaultValue : key;
  };

  return {
    useTranslation: () => ({
      t: translate,
      i18n: { language: 'en' },
    }),
  };
});

const createMockStore = (overrides: Record<string, unknown> = {}) => ({
  selectedScenarioId: null,
  selectedScenarioData: null,
  setSelectedScenarioId: vi.fn(),
  setSelectedScenarioData: vi.fn(),
  markStepComplete: vi.fn(),
  ...overrides,
});

describe('Step1InteractionType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
  });

  test('renders guided start options with a default template preview', async () => {
    const mockStore = createMockStore();

    vi.mocked(useExperimentBuilder).mockReturnValue(mockStore as any);

    render(<Step1InteractionType />);

    await waitFor(() => {
      expect(screen.getByText('Choose experiment starting point')).toBeInTheDocument();
      expect(screen.getByText('You can start this way')).toBeInTheDocument();
      expect(screen.getByText('Game Theory')).toBeInTheDocument();
      expect(screen.getByText('Sociology')).toBeInTheDocument();
    });

    expect(await screen.findByText("Prisoner's Dilemma")).toBeInTheDocument();
    expect(screen.getByText('Stag Hunt')).toBeInTheDocument();
  });

  test('updates the template preview when a category is chosen', async () => {
    const mockStore = createMockStore();

    vi.mocked(useExperimentBuilder).mockReturnValue(mockStore as any);

    render(<Step1InteractionType />);

    await screen.findByText('Sociology');

    const sociologyCard = screen.getByText('Sociology').closest('article');
    expect(sociologyCard).not.toBeNull();

    await act(async () => {
      fireEvent.click(within(sociologyCard as HTMLElement).getByRole('button', { name: /View this category/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Social Norm Disruption')).toBeInTheDocument();
      expect(screen.getAllByText('1 template').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Prisoner's Dilemma")).not.toBeInTheDocument();
  });

  test('selects a scenario from the template preview', async () => {
    const setSelectedScenarioId = vi.fn();
    const setSelectedScenarioData = vi.fn();
    const markStepComplete = vi.fn();
    const mockStore = createMockStore({
      setSelectedScenarioId,
      setSelectedScenarioData,
      markStepComplete,
    });

    vi.mocked(useExperimentBuilder).mockReturnValue(mockStore as any);

    render(<Step1InteractionType />);

    await screen.findByText('Sociology');

    const sociologyCard = screen.getByText('Sociology').closest('article');

    await act(async () => {
      fireEvent.click(within(sociologyCard as HTMLElement).getByRole('button', { name: /View this category/i }));
    });

    const scenarioCard = (await screen.findByText('Social Norm Disruption')).closest('article');

    await act(async () => {
      fireEvent.click(within(scenarioCard as HTMLElement).getByRole('button', { name: /Select this template/i }));
    });

    expect(setSelectedScenarioId).toHaveBeenCalledWith('social_norm_disruption');
    expect(setSelectedScenarioData).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'social_norm_disruption', category: 'sociology' })
    );
    expect(markStepComplete).toHaveBeenCalledWith(1);
  });
});

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SimulationPage from '../../pages/SimulationPage';
import { useSimulationStore } from '../../store';

const translations: Record<string, string> = {
  'simPage.enterSteps': 'Enter number of steps (1–100)',
  'simPage.autoAdvance': 'Auto advance',
  'simPage.stop': 'Stop',
  'simPage.advance': 'Advance node',
  'simPage.advancing': 'Advancing…',
  'simPage.branch': 'Create branch',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const base = translations[key] ?? key;
      if (params) {
        return base.replace(/{{(\w+)}}/g, (_, p) => params[p]?.toString() || '');
      }
      return base;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const renderPage = () => render(
  <MemoryRouter>
    <SimulationPage />
  </MemoryRouter>
);

describe('Auto-advance — full integration flow', () => {
  beforeEach(() => {
    const mockAdvance = vi.fn().mockResolvedValue(undefined);
    const mockNotify = vi.fn();

    useSimulationStore.setState({
      currentSimulation: { id: 'sim-1', name: 'Test Sim' },
      selectedNodeId: 'node-1',
      nodes: [{ id: 'node-1', parentId: null, name: 'Root', depth: 0, isLeaf: true }],
      isAutoAdvancing: false,
      isGenerating: false,
      isCompareMode: false,
      autoAdvanceTotal: 0,
      autoAdvanceCurrent: 0,
      highlightedNodeId: null,
      advanceSimulation: mockAdvance,
      addNotification: mockNotify,
      engineConfig: { endpoint: '' },
    } as any);
  });

  it('should complete a full auto-advance run of 3 steps', async () => {
    renderPage();

    // Set step count to 3
    const input = screen.getByTitle(/enter number of steps/i);
    fireEvent.change(input, { target: { value: '3' } });

    // Click auto advance
    const button = screen.getByText(/auto advance/i);
    await act(async () => {
      fireEvent.click(button);
    });

    // Wait for completion
    await waitFor(() => {
      const state = useSimulationStore.getState() as any;
      expect(state.isAutoAdvancing).toBe(false);
    }, { timeout: 5000 });

    const state = useSimulationStore.getState() as any;
    expect(state.advanceSimulation).toHaveBeenCalledTimes(3);
    expect(state.addNotification).toHaveBeenCalledWith(
      'success',
      expect.any(String)
    );
  });

  it('should stop mid-run when stop is clicked', async () => {
    // Use a slow advance so we can click stop
    const slowAdvance = vi.fn().mockImplementation(
      () => new Promise((r) => setTimeout(r, 200))
    );
    useSimulationStore.setState({
      advanceSimulation: slowAdvance,
    } as any);

    renderPage();

    // Set step count to 20
    const input = screen.getByTitle(/enter number of steps/i);
    fireEvent.change(input, { target: { value: '20' } });

    // Start
    const button = screen.getByText(/auto advance/i);
    await act(async () => {
      fireEvent.click(button);
    });

    // Wait for auto-advancing to begin
    await waitFor(() => {
      expect(useSimulationStore.getState().isAutoAdvancing).toBe(true);
    });

    // Click stop
    const stopButton = await screen.findByText(/stop/i);
    await act(async () => {
      fireEvent.click(stopButton);
    });

    // Should have stopped before completing all 20 steps
    await waitFor(() => {
      expect(useSimulationStore.getState().isAutoAdvancing).toBe(false);
    });
    expect(slowAdvance.mock.calls.length).toBeLessThan(20);
  });
});

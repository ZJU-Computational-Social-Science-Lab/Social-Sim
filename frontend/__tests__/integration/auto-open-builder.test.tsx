/**
 * Integration tests for auto-opening the experiment builder wizard.
 *
 * Verifies that navigating to /simulations/new (no simIdParam) automatically
 * opens the ExperimentBuilderModal, and that it does NOT open when a simulation
 * ID is present or when auth has not yet restored.
 *
 * Contains: Three test cases for the auto-open wizard effect.
 */

import { render, waitFor, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SimulationPage from '../../pages/SimulationPage';
import { useSimulationStore } from '../../store';
import { useAuthStore } from '../../store/auth';

vi.mock('../../components/ExperimentBuilderModal', () => ({
  ExperimentBuilderModal: ({ isOpen, presentation }: { isOpen?: boolean; presentation?: string }) => (
    isOpen ? <div data-testid="experiment-builder">{presentation || 'modal'}</div> : null
  ),
  default: ({ isOpen, presentation }: { isOpen?: boolean; presentation?: string }) => (
    isOpen ? <div data-testid="experiment-builder">{presentation || 'modal'}</div> : null
  ),
}));

// Minimal i18n mock
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) {
        return key.replace(/{{(\w+)}}/g, (_, p) => params[p]?.toString() || '');
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock all API service calls
vi.mock('../../services/simulations', () => ({
  getSimulation: vi.fn(),
  listSimulations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/simulationTree', () => ({
  getTreeGraph: vi.fn(),
  getSimEvents: vi.fn(),
  getSimState: vi.fn(),
  getRehydrate: vi.fn(),
}));

vi.mock('../../services/scenes', () => ({
  listScenes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/providers', () => ({
  listProviders: vi.fn().mockResolvedValue([]),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

describe('Workbench entry on /simulations/new', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      currentSimulation: null,
      nodes: [],
      isWizardOpen: false,
      isGenerating: false,
    } as any);
    useAuthStore.setState({
      isAuthenticated: true,
      hasRestored: true,
      user: { email: 'test@test.com' },
    } as any);
  });

  it('renders the builder when no current simulation exists', async () => {
    render(
      <MemoryRouter initialEntries={['/simulations/new']}>
        <Routes>
          <Route path="/simulations/new" element={<SimulationPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('experiment-builder')).toBeInTheDocument();
    });
  });

  it('redirects to the current simulation instead of opening a new builder', async () => {
    useSimulationStore.setState({
      currentSimulation: { id: 'sim-123', name: 'Existing Simulation' },
      nodes: [{ id: 'root', parentId: null, name: 'Root', depth: 0, isLeaf: true }],
      selectedNodeId: 'root',
    } as any);

    render(
      <MemoryRouter initialEntries={['/simulations/new']}>
        <LocationProbe />
        <Routes>
          <Route path="/simulations/new" element={<SimulationPage />} />
          <Route path="/simulations/:id" element={<SimulationPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toBe('/simulations/sim-123');
    });

    expect(screen.queryByTestId('experiment-builder')).not.toBeInTheDocument();
  });

  it('does NOT render the builder when a simulation ID is present', async () => {
    render(
      <MemoryRouter initialEntries={['/simulations/sim-123']}>
        <Routes>
          <Route path="/simulations/:id" element={<SimulationPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.queryByTestId('experiment-builder')).not.toBeInTheDocument();
  });
});

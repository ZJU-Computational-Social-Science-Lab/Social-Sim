// frontend/store/index.ts
//
// Main Zustand store composition.
//
// Responsibilities:
//   - Composes all slice functions into a single store
//   - Exports the combined AppState interface
//   - Maintains backward compatibility with existing imports
//
// Used by: All components that access the store

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createSimulationSlice, SimulationSlice } from './simulation';
import { createAgentsSlice, AgentsSlice } from './agents';
import { createLogsSlice, LogsSlice } from './logs';
import { createUISlice, UISlice } from './ui';
import { createExperimentsSlice, ExperimentsSlice } from './experiments';
import { createEnvironmentSlice, EnvironmentSlice } from './environment';
import { createProvidersSlice, ProvidersSlice } from './providers';
import type { StoreState } from './storeState';

export type AppState = StoreState;

// Create the composed store
export const useSimulationStore = create<StoreState>()(
  devtools(
    (set, get, api) => {
      // Return composed state
      return {
        ...createSimulationSlice(set, get, api),
        ...createAgentsSlice(set, get, api),
        ...createLogsSlice(set, get, api),
        ...createUISlice(set, get, api),
        ...createExperimentsSlice(set, get, api),
        ...createEnvironmentSlice(set, get, api),
        ...createProvidersSlice(set, get, api)
      };
    },
    { name: 'SimulationStore' }
  )
);

// Re-export helper functions for backward compatibility
export {
  generateAgentsWithAI,
  generateAgentsWithDemographics,
  mapBackendEventsToLogs,
  addTime,
  formatWorldTime,
  generateNodes,
  mapGraphToNodes,
  SYSTEM_TEMPLATES
} from './helpers';

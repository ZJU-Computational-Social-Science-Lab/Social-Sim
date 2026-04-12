import type { AgentsSlice } from './agents';
import type { EnvironmentSlice } from './environment';
import type { ExperimentsSlice } from './experiments';
import type { LogsSlice } from './logs';
import type { ProvidersSlice } from './providers';
import type { SimulationSlice } from './simulation';
import type { UISlice } from './ui';

export interface StoreState extends
  SimulationSlice,
  AgentsSlice,
  LogsSlice,
  UISlice,
  ExperimentsSlice,
  EnvironmentSlice,
  ProvidersSlice {}

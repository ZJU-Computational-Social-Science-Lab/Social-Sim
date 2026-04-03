// frontend/services/experiments.ts
import { apiPost, apiGet } from './client';

export interface VariantSpec {
  name: string;
  ops: any[];
}

/**
 * Mapping between experiment variants and simulation tree nodes.
 */
export interface ExperimentNodeMapping {
  variant_id: number;
  node_id: number;
  variant_name?: string;
}

/**
 * Configuration for creating a new experiment.
 * Matches the backend ExperimentCreateRequest schema.
 */
export interface ExperimentConfig {
  scenario_id: string;
  agents: Array<{
    name: string;
    properties?: Record<string, any>;
  }>;
  actions: Array<{
    name: string;
    parameters?: Record<string, any>;
  }>;
  parameters?: Record<string, any>;
}

/**
 * Experiment state returned from API.
 */
export interface Experiment {
  id: string;
  scenario_id: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  state: Record<string, any>;
}

/**
 * Result of running a single round.
 */
export interface RoundResult {
  round_num: number;
  actions: Array<{
    agent_name: string;
    action_name: string;
    parameters: Record<string, any>;
    result: Record<string, any>;
  }>;
  is_complete: boolean;
}

// === Existing A/B Testing Experiment Functions ===

export async function createExperiment(simulationId: string, name: string, baseNode: number, variants: VariantSpec[]) {
  const body = { name, base_node: baseNode, variants };
  return apiPost<{ experiment_id: string; node_mapping: ExperimentNodeMapping[] }>(`/simulations/${simulationId}/experiments`, body);
}

export async function runExperiment(simulationId: string, experimentId: string, turns = 1) {
  const body = { turns };
  return apiPost<{ run_id: string }>(`/simulations/${simulationId}/experiments/${experimentId}/run`, body);
}

export async function listExperiments(simulationId: string) {
  return apiGet<{ experiments: any[] }>(`/simulations/${simulationId}/experiments`);
}

export async function getExperiment(simulationId: string, expId: string) {
  return apiGet<any>(`/simulations/${simulationId}/experiments/${expId}`);
}

export async function compareNodes(simulationId: string, nodeA: number, nodeB: number, use_llm = false) {
  return apiPost<any>(`/simulations/${simulationId}/compare`, { node_a: nodeA, node_b: nodeB, use_llm });
}

// === New Council Experiment Functions ===

/**
 * Create a new council experiment via the experiment framework.
 * This uses the new experiment endpoint at /api/experiments
 * instead of the legacy simulation endpoint.
 */
export async function createCouncilExperiment(config: ExperimentConfig): Promise<Experiment> {
  return apiPost<Experiment>('/experiments', config);
}

/**
 * Run a single round of a council experiment.
 */
export async function runCouncilExperimentRound(experimentId: string): Promise<RoundResult> {
  return apiPost<RoundResult>(`/experiments/${experimentId}/round`, {});
}

/**
 * Get council experiment state by ID.
 */
export async function getCouncilExperiment(experimentId: string): Promise<Experiment> {
  return apiGet<Experiment>(`/experiments/${experimentId}`);
}

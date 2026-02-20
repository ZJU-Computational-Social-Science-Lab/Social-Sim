/**
 * Scenario service for fetching scenario definitions.
 */

export interface ScenarioParam {
  key: string;
  label: string;
  type: 'number' | 'text';
  default: unknown;
}

export interface ActionDef {
  name: string;
  description: string;
}

export interface ScenarioData {
  id: string;
  name: string;
  category: string;
  description: string;
  parameters: ScenarioParam[];
  actions: ActionDef[];
}

const API_BASE = '/api';

/**
 * Fetch all scenarios.
 */
export async function getAllScenarios(): Promise<ScenarioData[]> {
  const response = await fetch(`${API_BASE}/scenarios`);
  if (!response.ok) {
    throw new Error(`Failed to fetch scenarios: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch a single scenario by ID.
 */
export async function getScenario(id: string): Promise<ScenarioData> {
  const response = await fetch(`${API_BASE}/scenarios/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch scenario: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch actions for a scenario.
 */
export async function getScenarioActions(id: string): Promise<ActionDef[]> {
  const response = await fetch(`${API_BASE}/scenarios/${id}/actions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch scenario actions: ${response.statusText}`);
  }
  return response.json();
}

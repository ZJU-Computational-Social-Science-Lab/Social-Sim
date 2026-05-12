/**
 * Scenario service for fetching scenario definitions.
 */

import { getApiBase } from './base';

export interface ScenarioParam {
  key: string;
  label: string;
  description?: string;
  category?: string;
  type: 'integer' | 'number' | 'float' | 'string' | 'text' | 'boolean' | 'array';
  default: unknown;
  ui_hint?:
    | 'slider'
    | 'number'
    | 'percentage'
    | 'text'
    | 'textarea'
    | 'select'
    | 'toggle'
    | 'list'
    | 'multiselect'
    | 'key_value'
    | 'drag_list'
    | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  placeholder?: string;
  generates_actions?: boolean;  // Flag indicating this parameter generates actions
}

export interface ActionDef {
  id?: string;
  name: string;
  description: string;
}

export interface ScenarioData {
  id: string;
  name: string;
  category: string;
  description: string;
  interaction_mode?: 'simultaneous' | 'paired' | 'sequential';
  display_type?: 'payoff_matrix' | 'params';
  matrix_meta?: {
    symmetric: boolean;
    rows: string[];
    cols: string[];
    cells: Record<string, string>;
  };
  parameters: ScenarioParam[];
  actions: ActionDef[];
  category_actions?: ActionDef[];
  default_action_ids?: string[];
}

const API_BASE = getApiBase().replace(/\/+$/, '');

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

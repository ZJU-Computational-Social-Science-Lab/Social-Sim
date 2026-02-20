/**
 * Experiment Templates API Service
 *
 * Handles API calls for the Three-Layer Experiment Platform.
 * Provides functions to fetch available action types, create experiment templates,
 * and run experiments using the new structured action system.
 */

import { apiGet, apiPost } from './client';

// =============================================================================
// Types
// =============================================================================

/**
 * Action type definition matching backend schema
 */
export interface ActionType {
  value: string;
  label: string;
  description: string;
}

/**
 * Response from /action-types endpoint
 */
export interface AvailableActionsResponse {
  actions: ActionType[];
}

/**
 * Request payload for creating an experiment template
 */
export interface CreateTemplateRequest {
  name: string;
  description: string;
  actions: TemplateAction[];
  settings: TemplateSettings;
}

/**
 * Action definition for template creation
 */
export interface TemplateAction {
  action_type: string;
  name: string;
  description: string;
  parameters?: ActionParameter[];
}

/**
 * Action parameter definition
 */
export interface ActionParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

/**
 * Template settings
 */
export interface TemplateSettings {
  round_visibility: 'simultaneous' | 'sequential';
  max_rounds: number;
}

/**
 * Request payload for running an experiment
 */
export interface RunExperimentRequest {
  template_id: number | null;
  agents: any[];
  llm_config: any;
}

/**
 * Response from experiment creation/run
 */
export interface ExperimentRunResponse {
  experiment_id: number;
  message?: string;
}

// =============================================================================
// Action Type Mapping
// =============================================================================

/**
 * Map action names to ActionType enum values
 */
const ACTION_TYPE_MAPPING: Record<string, string> = {
  'cooperate': 'cooperate',
  'defect': 'defect',
  'conform': 'conform',
  'betray': 'defect',
  'invest': 'invest',
  'withdraw': 'withdraw',
  'share': 'share',
  'keep': 'keep',
  'move_left': 'move_left',
  'move_right': 'move_right',
  'stay': 'stay',
  'vote_yes': 'vote_yes',
  'vote_no': 'vote_no',
  'abstain': 'abstain',
  'speak': 'speak',
};

/**
 * Map action names to descriptions
 */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  'cooperate': 'Cooperate with the other player(s) for mutual benefit',
  'defect': 'Act in self-interest, potentially harming others',
  'conform': 'Align with the group choice or opinion',
  'betray': 'Break trust for personal gain',
  'invest': 'Contribute resources to a public good',
  'withdraw': 'Remove resources or opt out',
  'share': 'Distribute resources to others',
  'keep': 'Retain resources for oneself',
  'move_left': 'Move to the left in the spatial arrangement',
  'move_right': 'Move to the right in the spatial arrangement',
  'stay': 'Remain in current position',
  'vote_yes': 'Vote in favor of the proposal',
  'vote_no': 'Vote against the proposal',
  'abstain': 'Neither vote for nor against',
  'speak': 'Communicate with other agents',
};

/**
 * Get the ActionType enum value for an action name
 */
export function getActionType(actionName: string): string {
  return ACTION_TYPE_MAPPING[actionName.toLowerCase()] || 'custom';
}

/**
 * Get the description for an action name
 */
export function getActionDescription(actionName: string): string {
  return ACTION_DESCRIPTIONS[actionName.toLowerCase()] || actionName;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch available action types from backend
 * GET /api/experiment-templates/action-types
 */
export async function fetchAvailableActionTypes(): Promise<AvailableActionsResponse> {
  return apiGet<AvailableActionsResponse>('/experiment-templates/action-types');
}

/**
 * Create a new experiment template
 * POST /api/experiment-templates/templates
 */
export async function createExperimentTemplate(
  data: CreateTemplateRequest
): Promise<any> {
  return apiPost<any>('/experiment-templates/templates', data);
}

/**
 * Run an experiment from a template
 * POST /api/experiment-templates/run
 */
export async function runExperiment(
  data: RunExperimentRequest
): Promise<ExperimentRunResponse> {
  return apiPost<ExperimentRunResponse>('/experiment-templates/run', data);
}

/**
 * Delete an experiment template
 * DELETE /api/experiment-templates/templates/:id
 */
export async function deleteExperimentTemplate(id: number): Promise<void> {
  return apiPost<void>(`/experiment-templates/templates/${id}`, undefined);
}

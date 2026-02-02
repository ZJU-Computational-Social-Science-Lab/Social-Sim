import { apiClient } from './client';

export interface EnvironmentSuggestion {
  event_type: string;
  description: string;
  severity: string;
}

export interface SuggestionStatus {
  available: boolean;
  turn: number | null;
}

export async function getSuggestionStatus(simulationId: string): Promise<SuggestionStatus> {
  const response = await apiClient.get(`/simulations/${simulationId}/suggestions/status`);
  return response.data;
}

export async function generateSuggestions(simulationId: string): Promise<{ suggestions: EnvironmentSuggestion[] }> {
  const response = await apiClient.post(`/simulations/${simulationId}/suggestions/generate`);
  return response.data;
}

export async function applyEnvironmentEvent(
  simulationId: string,
  event: EnvironmentSuggestion,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post(`/simulations/${simulationId}/events/environment`, event);
  return response.data;
}

export async function dismissSuggestions(simulationId: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post(`/simulations/${simulationId}/suggestions/dismiss`);
  return response.data;
}

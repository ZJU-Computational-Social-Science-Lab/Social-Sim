import { apiClient } from './client';

export interface MultimodalContent {
  text?: string;
  image_url?: string;
  audio_url?: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentSuggestion {
  event_type: string;
  description: string;
  severity: string;
  notice_only?: boolean;
  receivers?: string[];
  multimodal?: MultimodalContent;
  is_custom?: boolean;
}

export interface SuggestionStatus {
  available: boolean;
  turn: number | null;
  enabled?: boolean;
}

export interface CustomEnvironmentEvent extends EnvironmentSuggestion {
  is_custom: true;
  created_by?: string;
  created_at?: string;
  config_mode?: 'global' | 'agent';
  target_agent_id?: string;
}

export async function getSuggestionStatus(simulationId: string): Promise<SuggestionStatus> {
  const response = await apiClient.get(`/simulations/${simulationId}/suggestions/status`);
  return response.data;
}

export async function generateSuggestions(simulationId: string): Promise<EnvironmentSuggestion[]> {
  const response = await apiClient.post(`/simulations/${simulationId}/suggestions/generate`);
  return response.data.suggestions;
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

export async function createCustomEnvironmentEvent(
  simulationId: string,
  event: CustomEnvironmentEvent,
): Promise<{ success: boolean; message: string; event: CustomEnvironmentEvent }> {
  const response = await apiClient.post(`/simulations/${simulationId}/events/custom-environment`, event);
  return response.data;
}

export async function uploadMediaForEvent(
  simulationId: string,
  file: File,
  mediaType: 'image' | 'audio',
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', mediaType);
  const response = await apiClient.post(`/simulations/${simulationId}/events/upload-media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

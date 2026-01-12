// frontend/api/simulations.ts

// 这一部分：给「旧前端」页面用（Dashboard / SavedSimulations 等）
// 使用 axios backendClient，走后端 /api/simulations 这些接口
import { apiClient } from "./backendClient";

// 列表类型可以先用 any，后面你想再加类型也可以
export async function listSimulations(): Promise<any[]> {
  const { data } = await apiClient.get("/simulations");
  return data;
}

export async function deleteSimulation(simulationId: string): Promise<void> {
  await apiClient.delete(`/simulations/${simulationId}`);
}

export async function copySimulation(simulationId: string): Promise<any> {
  const { data } = await apiClient.post(
    `/simulations/${simulationId}/copy`,
    {}
  );
  return data;
}

export async function resumeSimulation(simulationId: string): Promise<any> {
  const { data } = await apiClient.post(
    `/simulations/${simulationId}/resume`,
    {}
  );
  return data;
}

// Fetch a single simulation by id
export async function getSimulation(simulationId: string): Promise<any> {
  const { data } = await apiClient.get(`/simulations/${encodeURIComponent(simulationId)}`);
  return data;
}

// 一般用于给仿真改名 / 保存状态之类
export async function saveSimulation(
  simulationId: string,
  payload: { name?: string; [key: string]: any } = {}
): Promise<any> {
  const { data } = await apiClient.post(
    `/simulations/${simulationId}/save`,
    payload
  );
  return data;
}

// Update an existing simulation (patch)
export async function updateSimulation(
  simulationId: string,
  payload: { name?: string; [key: string]: any } = {}
): Promise<any> {
  const { data } = await apiClient.patch(`/simulations/${encodeURIComponent(simulationId)}`, payload);
  return data;
}

export async function enqueueSync(simulationId: string | null, payload: any): Promise<any> {
  const id = simulationId ? encodeURIComponent(simulationId) : '';
  const { data } = await apiClient.post(`/simulations/${id}/sync`, payload || {});
  return data;
}

export async function getSyncLog(simulationId: string | null, syncLogId: number): Promise<any> {
  const id = simulationId ? encodeURIComponent(simulationId) : '';
  const { data } = await apiClient.get(`/simulations/${id}/sync/${syncLogId}`);
  return data;
}

// ---------------------------------------------------------
// 这一部分：给「新前端 / SimTree」用（store.ts 里的 createSimulationApi / startSimulation）
// 注意：这里保留 base / token 参数以兼容调用方，但**不再使用**，统一走 apiClient，
// 这样就会自动带上登录 Cookie / Bearer Token，不会再 401。
// ---------------------------------------------------------

type CreateSimulationPayload = any;

// 创建仿真（connected 模式用）
export async function createSimulation(
  base: string, // 兼容旧签名，实际不再使用
  payload: CreateSimulationPayload,
  token?: string // 兼容旧签名，实际不再使用
): Promise<any> {
  const { data } = await apiClient.post("/simulations", payload);
  return data;
}

// 启动仿真（connected 模式用）
export async function startSimulation(
  base: string, // 兼容旧签名，实际不再使用
  simulationId: string,
  token?: string // 兼容旧签名，实际不再使用
): Promise<any> {
  const { data } = await apiClient.post(
    `/simulations/${encodeURIComponent(simulationId)}/start`,
    {}
  );
  return data;
}

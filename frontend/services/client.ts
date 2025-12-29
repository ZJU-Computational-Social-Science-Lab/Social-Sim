// frontend/api/client.ts

import axios from "axios";
import { useAuthStore } from "../store/auth";
import { getApiBase } from "./base";

/**
 * 统一的后端基础 URL（例如 http://localhost:8000/api）
 */
export const API_BASE_URL = getApiBase().replace(/\/+$/, "");
console.log("Api base url is :", API_BASE_URL);

/**
 * 旧前端使用的 axios 客户端，给 Login/Register/Admin/Providers 等用
 */
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/`,
});

// ---- 拦截器：自动带上 access token，并处理 401 刷新 ----
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    if (response?.status === 401 && !(config as any).__isRetryRequest) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const refreshResponse = await axios.post(
            `${API_BASE_URL}/auth/token/refresh`,
            { refresh_token: refreshToken },
          );
          const data = refreshResponse.data as {
            access_token: string;
            refresh_token: string;
          };
          useAuthStore.getState().updateTokens(
            data.access_token,
            data.refresh_token,
          );
          (config as any).__isRetryRequest = true;
          config.headers = config.headers ?? {};
          (config.headers as any).Authorization = `Bearer ${data.access_token}`;
          return apiClient(config);
        } catch (refreshError) {
          useAuthStore.getState().clearSession();
        }
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------
// 下面是新前端用的轻量 HTTP 工具（保留原有写法，避免其它文件改动）
// ---------------------------------------------------------------------

export function buildUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.replace(/^\//, "");
  return `${b}/${p}`;
}

export async function httpGet<T>(
  base: string,
  path: string,
  token?: string,
): Promise<T> {
  const url = buildUrl(base, path);
  const res = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function httpPost<T>(
  base: string,
  path: string,
  body?: any,
  token?: string,
): Promise<T> {
  const url = buildUrl(base, path);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function httpDelete<T>(
  base: string,
  path: string,
  token?: string,
): Promise<T> {
  const url = buildUrl(base, path);
  const res = await fetch(url, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

/**
 * 方便只用当前后端地址的简单封装（新代码里如果有用到 apiGet/apiPost 也还能工作）
 */
export function apiGet<T>(path: string, token?: string): Promise<T> {
  return httpGet<T>(API_BASE_URL, path, token);
}

export function apiPost<T>(path: string, body?: any, token?: string): Promise<T> {
  return httpPost<T>(API_BASE_URL, path, body, token);
}

export function apiDelete<T>(path: string, token?: string): Promise<T> {
  return httpDelete<T>(API_BASE_URL, path, token);
}

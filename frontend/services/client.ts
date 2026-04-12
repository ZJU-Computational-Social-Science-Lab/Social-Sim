// frontend/api/client.ts

import axios, { type Method } from "axios";
import { useAuthStore } from "../store/auth";
import { getApiBase } from "./base";

/**
 * 统一的后端基础 URL（例如 http://localhost:8000/api）
 */
export const API_BASE_URL = getApiBase().replace(/\/+$/, "");

/**
 * 旧前端使用的 axios 客户端，给 Login/Register/Admin/Providers 等用
 */
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/`,
});

// Track token refresh state to prevent race conditions
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}>[] = [];

const processQueue = (error: any | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ---- 拦截器：自动带上 access token，并处理 401 刷新 ----
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  const hasAuthorizationHeader =
    Boolean((config.headers as any)?.Authorization) ||
    Boolean((config.headers as any)?.authorization);
  if (token && !hasAuthorizationHeader) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const originalRequest = config;

    if (response?.status === 401 && originalRequest && !(originalRequest as any).__isRetryRequest) {
      // If refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              (originalRequest.headers as any).Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
        }

      isRefreshing = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const refreshBase = String(originalRequest?.baseURL || `${API_BASE_URL}/`).replace(/\/+$/, "");
          const refreshResponse = await axios.post(
            `${refreshBase}/auth/token/refresh`,
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

          processQueue(null, data.access_token);

          (originalRequest as any).__isRetryRequest = true;
          if (originalRequest.headers) {
            originalRequest.headers = originalRequest.headers ?? {};
            (originalRequest.headers as any).Authorization = `Bearer ${data.access_token}`;
          }
          return apiClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          // Check if another request already refreshed the token before clearing session
          const currentToken = useAuthStore.getState().accessToken;
          if (!currentToken) {
            useAuthStore.getState().clearSession();
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token available, clear session
        processQueue(error, null);
        useAuthStore.getState().clearSession();
      }
    }
    return Promise.reject(error);
  },
);

const normalizeBase = (base: string): string => base.replace(/\/+$/, "");
const normalizePath = (path: string): string => path.replace(/^\/+/, "");

async function requestJson<T>(
  method: Method,
  base: string,
  path: string,
  body?: any,
  token?: string,
): Promise<T> {
  const response = await apiClient.request<T>({
    method,
    baseURL: `${normalizeBase(base)}/`,
    url: normalizePath(path),
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  return (response.data === '' ? undefined : response.data) as T;
}

export async function httpGet<T>(
  base: string,
  path: string,
  token?: string,
): Promise<T> {
  return requestJson<T>("GET", base, path, undefined, token);
}

export async function httpPost<T>(
  base: string,
  path: string,
  body?: any,
  token?: string,
): Promise<T> {
  return requestJson<T>("POST", base, path, body, token);
}

export async function httpDelete<T>(
  base: string,
  path: string,
  token?: string,
): Promise<T> {
  return requestJson<T>("DELETE", base, path, undefined, token);
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

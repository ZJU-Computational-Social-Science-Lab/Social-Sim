// src/api/base.ts
export function getApiBase(): string {
  // 本地开发: /api (通过 vite proxy 转发到后端)
  return "/api";
}

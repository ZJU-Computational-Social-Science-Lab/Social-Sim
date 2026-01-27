// frontend/vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

// 非常简化版：提供一个虚拟模块 "virtual:docs"
// 以后你想接入真正的 md/mdx 文档，我们只需要改这里
function virtualDocsPlugin(): Plugin {
  return {
    name: "virtual-docs",

    // 告诉 Vite：当有人 import "virtual:docs" 时，用一个虚拟 id 处理
    resolveId(id) {
      if (id === "virtual:docs") {
        return "\0virtual:docs"; // 特殊前缀 \0 表示虚拟模块
      }
    },

    // 真正返回这个虚拟模块的代码
    load(id) {
      if (id === "\0virtual:docs") {
        // 注意：这里是“字符串里的 TS/JS 代码”，会被 Rollup 当成源码来编译
        return `
          // 你 DocsPage.tsx 里 import docs from "virtual:docs" 时拿到的就是这个对象
          const docs = {
            sections: [
              {
                id: "overview",
                title: "SocialSim4 文档占位",
                lang: "zh",
                html: "<h1>SocialSim4 文档</h1><p>这里是占位内容，说明 virtual:docs 已经正常工作。</p>"
              }
            ]
          };
          export default docs;
        `;
      }
    },
  };
}

// 本地开发配置
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const host = env.LISTEN_ADDRESS || "0.0.0.0";
  const port = Number(env.LISTEN_PORT || 5173);
  const backendPort = Number(env.BACKEND_PORT || 8000);

  return {
    base: "/",
    plugins: [
      react(),
      virtualDocsPlugin(),
    ],
    server: {
      host,
      port,
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        "/uploads": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});

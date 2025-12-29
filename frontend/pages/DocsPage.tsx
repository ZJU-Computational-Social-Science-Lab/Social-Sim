// frontend/pages/DocsPage.tsx
import React from "react";
import { TitleCard } from "../components/TitleCard";

export function DocsPage() {
  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        padding: "1rem 1.5rem",
        boxSizing: "border-box",
      }}
    >
      <TitleCard title="文档 / 使用说明" />

      <div className="panel" style={{ gap: "0.75rem" }}>
        <div className="panel-title">SocialSim4 文档暂未集成</div>

        <div className="card" style={{ lineHeight: 1.6, fontSize: "0.95rem" }}>
          <p>
            目前这个部署中，还没有接入原始项目里的
            <code style={{ padding: "0 0.2rem" }}>virtual:docs</code>
            MDX 文档系统，所以这里先提供一个占位页面，避免构建报错。
          </p>

          <p>
            你仍然可以正常使用：
          </p>
          <ul style={{ paddingLeft: "1.2rem", marginTop: "0.4rem" }}>
            <li>登录 / 注册</li>
            <li>Dashboard / 保存的仿真列表</li>
            <li>新前端的仿真界面（SocialSim4 Next）</li>
            <li>Settings 里的 API Provider / Search Provider 设置</li>
          </ul>

          <p style={{ marginTop: "0.8rem" }}>
            如果以后你想恢复完整的文档系统，我们可以再做：
          </p>
          <ol style={{ paddingLeft: "1.2rem", marginTop: "0.4rem" }}>
            <li>
              在 <code>frontend</code> 里增加一个 Vite 插件，自动收集
              <code>docs/**/*.mdx</code> 文件，生成{" "}
              <code>virtual:docs</code> 模块。
            </li>
            <li>
              再把原来的 <code>docsIndex</code> / <code>docsTree</code>{" "}
              导出接上。
            </li>
          </ol>

          <p style={{ marginTop: "0.8rem", color: "#64748b" }}>
            当前版本的目标是：<strong>保证系统能完整打包并运行</strong>，
            不会再因为 <code>virtual:docs</code> 这些开发期虚拟模块而中断构建。
          </p>
        </div>
      </div>
    </div>
  );
}

export default DocsPage;

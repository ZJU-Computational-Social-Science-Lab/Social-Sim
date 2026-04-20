// frontend/components/provider-management/ProviderEmptyState.tsx
import { Server } from "lucide-react";

type ProviderEmptyStateProps = {
  onAddProvider: () => void;
};

export function ProviderEmptyState({ onAddProvider }: ProviderEmptyStateProps) {
  return (
    <section className="provider-empty-state">
      <div className="provider-empty-state__icon">
        <Server size={28} />
      </div>
      <h2>还没有 LLM 配置，先新增一个开始使用</h2>
      <p>支持 OpenAI Compatible 与 Google Gemini 两类模型接入。</p>
      <button type="button" className="provider-button provider-button--primary" onClick={onAddProvider}>
        新增 LLM
      </button>
    </section>
  );
}

// frontend/components/llm-console/ProviderPanel.tsx
import { useState } from "react";
import { Edit2, Trash2, Play, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Provider } from "../../services/providers";

type ProviderPanelProps = {
  providers: Provider[];
  selectedProviderId: number | null;
  onSelectProvider: (id: number) => void;
  onEditProvider: (id: number) => void;
  onDeleteProvider: (id: number) => void;
  onTestProvider: (id: number) => void;
  onSetDefault: (id: number) => void;
};

export function ProviderPanel({
  providers,
  selectedProviderId,
  onSelectProvider,
  onEditProvider,
  onDeleteProvider,
  onTestProvider,
  onSetDefault,
}: ProviderPanelProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const getProviderTypeLabel = (provider: string) => {
    if (provider.includes("openai")) return "OpenAI";
    if (provider.includes("gemini")) return "Gemini";
    if (provider.includes("deepseek")) return "DeepSeek";
    if (provider.includes("azure")) return "Azure";
    return provider;
  };

  return (
    <div className="llm-provider-panel">
      <div className="llm-panel-header">
        <h3 className="llm-panel-title">
          {isZh ? "Provider 管理" : "Provider Management"}
        </h3>
        <span className="llm-panel-badge">{providers.length}</span>
      </div>

      <div className="llm-provider-list">
        {providers.length === 0 ? (
          <div className="llm-empty-state">
            <p>{isZh ? "未配置任何 Provider" : "No providers configured"}</p>
            <p className="llm-empty-hint">
              {isZh
                ? '点击顶部“新增 Provider”开始'
                : 'Click "New Provider" above'}
            </p>
          </div>
        ) : (
          providers.map((provider) => (
            <div
              key={provider.id}
              className={`llm-provider-card ${
                selectedProviderId === provider.id ? "is-selected" : ""
              }`}
              onMouseEnter={() => setHoveredId(provider.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelectProvider(provider.id)}
            >
              <div className="llm-provider-card__main">
                <div className="llm-provider-card__header">
                  <h4 className="llm-provider-card__name">{provider.name}</h4>
                  {provider.is_default && (
                    <span className="llm-badge llm-badge--default">
                      {isZh ? "默认" : "Default"}
                    </span>
                  )}
                </div>

                <div className="llm-provider-card__meta">
                  <span className="llm-meta-type">
                    {getProviderTypeLabel(provider.provider)}
                  </span>
                  <span className="llm-meta-url" title={provider.base_url || ""}>
                    {provider.base_url ? provider.base_url.substring(0, 30) + "..." : ""}
                  </span>
                </div>

                <div className="llm-provider-card__status">
                  <span className="llm-meta-models">
                    {provider.model ? `${provider.model}` : "—"}
                  </span>
                  <span
                    className={`llm-status-dot ${
                      provider.last_test_status === "success"
                        ? "is-success"
                        : provider.last_test_status === "failed"
                          ? "is-failed"
                          : "is-untested"
                    }`}
                    title={provider.last_test_status || "untested"}
                  />
                </div>
              </div>

              {hoveredId === provider.id && (
                <div className="llm-provider-card__actions">
                  <button
                    className="llm-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTestProvider(provider.id);
                    }}
                    title={isZh ? "测试连接" : "Test connection"}
                  >
                    <Play size={14} />
                  </button>
                  <button
                    className="llm-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProvider(provider.id);
                    }}
                    title={isZh ? "编辑" : "Edit"}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="llm-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefault(provider.id);
                    }}
                    title={isZh ? "设为默认" : "Set as default"}
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    className="llm-icon-button llm-icon-button--danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          isZh
                            ? "确定删除此 Provider？"
                            : "Delete this provider?"
                        )
                      ) {
                        onDeleteProvider(provider.id);
                      }
                    }}
                    title={isZh ? "删除" : "Delete"}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

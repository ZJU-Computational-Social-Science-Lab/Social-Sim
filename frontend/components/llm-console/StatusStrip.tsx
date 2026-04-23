// frontend/components/llm-console/StatusStrip.tsx
import { useMemo } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Provider } from "../../services/providers";
import type { ModelRecord } from "../../services/models";

type StatusStripProps = {
  providers: Provider[];
  models: ModelRecord[];
  activeProvider: Provider | undefined;
  defaultModel: ModelRecord | undefined;
  lastTestStatus?: "success" | "failed" | null;
  onAddProvider: () => void;
};

export function StatusStrip({
  providers,
  models,
  activeProvider,
  defaultModel,
  lastTestStatus,
  onAddProvider,
}: StatusStripProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  const enabledModels = useMemo(() => models.filter((m) => m.enabled), [models]);

  const statusColor =
    lastTestStatus === "success"
      ? "text-green-600"
      : lastTestStatus === "failed"
        ? "text-red-600"
        : "text-gray-500";

  return (
    <div className="llm-status-strip">
      <div className="llm-status-strip__inner">
        <div className="llm-status-strip__metrics">
          <div className="llm-status-item">
            <span className="llm-status-label">
              {isZh ? "Provider 数" : "Providers"}
            </span>
            <strong className="llm-status-value">{providers.length}</strong>
          </div>

          <div className="llm-status-item">
            <span className="llm-status-label">
              {isZh ? "启用模型" : "Active Models"}
            </span>
            <strong className="llm-status-value">{enabledModels.length}</strong>
          </div>

          <div className="llm-status-item">
            <span className="llm-status-label">
              {isZh ? "默认模型" : "Default Model"}
            </span>
            <strong className="llm-status-value">
              {defaultModel?.displayName || "—"}
            </strong>
          </div>

          <div className="llm-status-item">
            <span className="llm-status-label">
              {isZh ? "当前活跃" : "Active"}
            </span>
            <strong className="llm-status-value">
              {activeProvider?.name || "—"}
            </strong>
          </div>

          <div className="llm-status-item">
            <span className="llm-status-label">
              {isZh ? "最近测试" : "Last Test"}
            </span>
            <strong className={`llm-status-value ${statusColor}`}>
              {lastTestStatus === "success"
                ? isZh
                  ? "✓ 通过"
                  : "✓ Pass"
                : lastTestStatus === "failed"
                  ? isZh
                    ? "✗ 失败"
                    : "✗ Failed"
                  : "—"}
            </strong>
          </div>
        </div>

        <div className="llm-status-strip__actions">
          <button
            className="llm-button llm-button--primary"
            onClick={onAddProvider}
            title={isZh ? "添加新的Provider" : "Add new provider"}
          >
            <Plus size={16} />
            <span>{isZh ? "新增 Provider" : "New Provider"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

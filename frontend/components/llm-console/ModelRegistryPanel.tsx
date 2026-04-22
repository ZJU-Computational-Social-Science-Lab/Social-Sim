// frontend/components/llm-console/ModelRegistryPanel.tsx
import { useMemo, useState } from "react";
import { Plus, Download, Upload, Edit2, Trash2, Copy, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ModelRecord } from "../../services/models";
import type { Provider } from "../../services/providers";

type ModelRegistryPanelProps = {
  models: ModelRecord[];
  providers: Provider[];
  selectedModelId: string | null;
  searchQuery: string;
  providerFilter: number | null;
  capabilityFilter: string[];
  onlyEnabled: boolean;
  onSelectModel: (id: string) => void;
  onAddModel: () => void;
  onEditModel: (id: string) => void;
  onDeleteModel: (id: string) => void;
  onDuplicateModel: (id: string) => void;
  onSetDefault: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onSearch: (query: string) => void;
  onFilterProvider: (id: number | null) => void;
  onFilterCapabilities: (caps: string[]) => void;
  onToggleOnlyEnabled: (enabled: boolean) => void;
  onBatchImport: () => void;
  onExport: () => void;
};

export function ModelRegistryPanel({
  models,
  providers,
  selectedModelId,
  searchQuery,
  providerFilter,
  capabilityFilter,
  onlyEnabled,
  onSelectModel,
  onAddModel,
  onEditModel,
  onDeleteModel,
  onDuplicateModel,
  onSetDefault,
  onToggleEnabled,
  onSearch,
  onFilterProvider,
  onFilterCapabilities,
  onToggleOnlyEnabled,
  onBatchImport,
  onExport,
}: ModelRegistryPanelProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);

  const allCapabilities = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => m.capabilities.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [models]);

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      // 启用状态过滤
      if (onlyEnabled && !model.enabled) return false;

      // Provider 过滤
      if (providerFilter && model.providerId !== providerFilter) return false;

      // 能力过滤
      if (
        capabilityFilter.length > 0 &&
        !capabilityFilter.some((cap) => model.capabilities.includes(cap as any))
      ) {
        return false;
      }

      // 搜索过滤
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          model.displayName.toLowerCase().includes(q) ||
          model.modelId.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [models, onlyEnabled, providerFilter, capabilityFilter, searchQuery]);

  const getProviderName = (id: number) =>
    providers.find((p) => p.id === id)?.name || "—";

  return (
    <div className="llm-model-registry">
      {/* 工具栏 */}
      <div className="llm-registry-toolbar">
        <div className="llm-registry-search">
          <input
            type="text"
            className="llm-search-input"
            placeholder={
              isZh ? "搜索模型名称或ID..." : "Search model name or ID..."
            }
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <div className="llm-registry-filters">
          <select
            className="llm-filter-select"
            value={providerFilter || ""}
            onChange={(e) =>
              onFilterProvider(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">
              {isZh ? "所有 Provider" : "All Providers"}
            </option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="llm-capability-filter">
            {allCapabilities.map((cap) => (
              <label key={cap} className="llm-capability-checkbox">
                <input
                  type="checkbox"
                  checked={capabilityFilter.includes(cap)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onFilterCapabilities([...capabilityFilter, cap]);
                    } else {
                      onFilterCapabilities(
                        capabilityFilter.filter((c) => c !== cap)
                      );
                    }
                  }}
                />
                <span>{cap}</span>
              </label>
            ))}
          </div>

          <label className="llm-enabled-toggle">
            <input
              type="checkbox"
              checked={onlyEnabled}
              onChange={(e) => onToggleOnlyEnabled(e.target.checked)}
            />
            <span>{isZh ? "仅显示启用" : "Enabled only"}</span>
          </label>
        </div>

        <div className="llm-registry-actions">
          <button
            className="llm-button llm-button--secondary"
            onClick={onBatchImport}
            title={isZh ? "批量导入模型" : "Batch import models"}
          >
            <Upload size={14} />
            <span>{isZh ? "批量导入" : "Import"}</span>
          </button>
          <button
            className="llm-button llm-button--secondary"
            onClick={onExport}
            title={isZh ? "导出配置" : "Export configuration"}
          >
            <Download size={14} />
            <span>{isZh ? "导出" : "Export"}</span>
          </button>
          <button
            className="llm-button llm-button--primary"
            onClick={onAddModel}
            title={isZh ? "新增模型" : "Add new model"}
          >
            <Plus size={14} />
            <span>{isZh ? "新增模型" : "New Model"}</span>
          </button>
        </div>
      </div>

      {/* 模型列表 */}
      <div className="llm-model-table-wrap">
        <table className="llm-model-table">
          <thead>
            <tr>
              <th style={{ width: "200px" }}>
                {isZh ? "模型显示名" : "Model Name"}
              </th>
              <th style={{ width: "150px" }}>Model ID</th>
              <th style={{ width: "120px" }}>Provider</th>
              <th style={{ width: "100px" }}>
                {isZh ? "协议" : "Protocol"}
              </th>
              <th style={{ width: "150px" }}>
                {isZh ? "能力" : "Capabilities"}
              </th>
              <th style={{ width: "100px" }}>
                {isZh ? "上下文" : "Context"}
              </th>
              <th style={{ width: "100px" }}>
                {isZh ? "价格 (I/O)" : "Price"}
              </th>
              <th style={{ width: "60px" }}>
                {isZh ? "状态" : "Status"}
              </th>
              <th style={{ width: "120px" }}>
                {isZh ? "最近测试" : "Last Test"}
              </th>
              <th style={{ width: "180px" }}>
                {isZh ? "操作" : "Actions"}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.length === 0 ? (
              <tr>
                <td colSpan={10} className="llm-table-empty">
                  {isZh ? "没有匹配的模型" : "No matching models"}
                </td>
              </tr>
            ) : (
              filteredModels.map((model) => (
                <tr
                  key={model.id}
                  className={`llm-model-row ${
                    selectedModelId === model.id ? "is-selected" : ""
                  }`}
                  onMouseEnter={() => setHoveredModelId(model.id || null)}
                  onMouseLeave={() => setHoveredModelId(null)}
                  onClick={() => onSelectModel(model.id || "")}
                >
                  <td className="llm-cell-name">
                    <div className="llm-cell-content">
                      <strong>{model.displayName}</strong>
                      {model.isDefault && (
                        <span className="llm-badge llm-badge--small">
                          {isZh ? "默认" : "Default"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="llm-cell-mono">{model.modelId}</td>
                  <td className="llm-cell-provider">
                    {getProviderName(model.providerId)}
                  </td>
                  <td className="llm-cell-protocol">
                    <span className="llm-badge llm-badge--light">
                      {model.protocolType}
                    </span>
                  </td>
                  <td className="llm-cell-capabilities">
                    <div className="llm-caps-list">
                      {model.capabilities.slice(0, 2).map((cap) => (
                        <span key={cap} className="llm-cap-tag">
                          {cap}
                        </span>
                      ))}
                      {model.capabilities.length > 2 && (
                        <span className="llm-cap-more">
                          +{model.capabilities.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="llm-cell-mono">
                    {(model.contextWindow / 1000).toFixed(0)}K
                  </td>
                  <td className="llm-cell-price">
                    {model.inputPrice ? (
                      <>
                        ${model.inputPrice.toFixed(2)} /
                        <br />
                        ${model.outputPrice?.toFixed(2) || "—"}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="llm-cell-status">
                    <input
                      type="checkbox"
                      checked={model.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleEnabled(model.id || "", e.target.checked);
                      }}
                      title={isZh ? "启用/停用" : "Enable/disable"}
                    />
                  </td>
                  <td className="llm-cell-test">
                    <span
                      className={`llm-test-status ${
                        model.lastTestStatus === "success"
                          ? "is-success"
                          : model.lastTestStatus === "failed"
                            ? "is-failed"
                            : ""
                      }`}
                    >
                      {model.lastTestStatus === "success"
                        ? "✓"
                        : model.lastTestStatus === "failed"
                          ? "✗"
                          : "—"}
                    </span>
                  </td>
                  <td className="llm-cell-actions">
                    {hoveredModelId === model.id && (
                      <div className="llm-action-buttons">
                        <button
                          className="llm-icon-button llm-icon-button--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditModel(model.id || "");
                          }}
                          title={isZh ? "编辑" : "Edit"}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="llm-icon-button llm-icon-button--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateModel(model.id || "");
                          }}
                          title={isZh ? "复制" : "Duplicate"}
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          className="llm-icon-button llm-icon-button--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetDefault(model.id || "");
                          }}
                          title={isZh ? "设为默认" : "Set as default"}
                        >
                          <CheckCircle size={12} />
                        </button>
                        <button
                          className="llm-icon-button llm-icon-button--sm llm-icon-button--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                isZh ? "确定删除此模型？" : "Delete this model?"
                              )
                            ) {
                              onDeleteModel(model.id || "");
                            }
                          }}
                          title={isZh ? "删除" : "Delete"}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="llm-table-footer">
        {isZh
          ? `显示 ${filteredModels.length} / ${models.length} 个模型`
          : `Showing ${filteredModels.length} / ${models.length} models`}
      </div>
    </div>
  );
}

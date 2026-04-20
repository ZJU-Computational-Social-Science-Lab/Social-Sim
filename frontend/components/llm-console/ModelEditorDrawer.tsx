// frontend/components/llm-console/ModelEditorDrawer.tsx
import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ModelRecord } from "../../services/models";
import type { Provider } from "../../services/providers";

const CAPABILITY_OPTIONS = ["text", "vision", "audio", "json", "function_call", "reasoning"];

type ModelEditorDrawerProps = {
  isOpen: boolean;
  editingModel: ModelRecord | null;
  providers: Provider[];
  onClose: () => void;
  onSubmit: (data: Omit<ModelRecord, "id"> | Partial<ModelRecord>) => Promise<void>;
};

export function ModelEditorDrawer({
  isOpen,
  editingModel,
  providers,
  onClose,
  onSubmit,
}: ModelEditorDrawerProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [formData, setFormData] = useState<Omit<ModelRecord, "id">>({
    displayName: "",
    modelId: "",
    providerId: 0,
    protocolType: "openai",
    capabilities: ["text"],
    contextWindow: 4096,
    inputPrice: undefined,
    outputPrice: undefined,
    tags: [],
    enabled: true,
    isDefault: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingModel) {
      setFormData(editingModel);
    } else {
      setFormData({
        displayName: "",
        modelId: "",
        providerId: providers.length > 0 ? providers[0].id : 0,
        protocolType: "openai",
        capabilities: ["text"],
        contextWindow: 4096,
        inputPrice: undefined,
        outputPrice: undefined,
        tags: [],
        enabled: true,
        isDefault: false,
      });
    }
  }, [editingModel, providers, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCapability = (cap: string) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap as any)
        ? prev.capabilities.filter((c) => c !== cap)
        : ([...prev.capabilities, cap] as any),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={`llm-drawer ${isOpen ? "is-open" : ""}`}>
      <div className="llm-drawer-overlay" onClick={onClose} />
      <div className="llm-drawer-content">
        <div className="llm-drawer-header">
          <h2 className="llm-drawer-title">
            {editingModel
              ? isZh
                ? "编辑模型"
                : "Edit Model"
              : isZh
                ? "新增模型"
                : "New Model"}
          </h2>
          <button className="llm-drawer-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="llm-drawer-form">
          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "显示名" : "Display Name"} *
            </label>
            <input
              type="text"
              required
              className="llm-form-input"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              placeholder={isZh ? "如：GPT-4 Turbo" : "e.g. GPT-4 Turbo"}
            />
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "模型 ID" : "Model ID"} *
            </label>
            <input
              type="text"
              required
              className="llm-form-input"
              value={formData.modelId}
              onChange={(e) =>
                setFormData({ ...formData, modelId: e.target.value })
              }
              placeholder={isZh ? "如：gpt-4-turbo" : "e.g. gpt-4-turbo"}
            />
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "Provider" : "Provider"} *
            </label>
            <select
              required
              className="llm-form-input"
              value={formData.providerId}
              onChange={(e) =>
                setFormData({ ...formData, providerId: Number(e.target.value) })
              }
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "协议类型" : "Protocol Type"} *
            </label>
            <select
              required
              className="llm-form-input"
              value={formData.protocolType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  protocolType: e.target.value as any,
                })
              }
            >
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "能力标签" : "Capabilities"}
            </label>
            <div className="llm-capability-checkboxes">
              {CAPABILITY_OPTIONS.map((cap) => (
                <label key={cap} className="llm-checkbox-item">
                  <input
                    type="checkbox"
                    checked={formData.capabilities.includes(cap as any)}
                    onChange={() => toggleCapability(cap)}
                  />
                  <span>{cap}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "上下文长度" : "Context Window"} *
            </label>
            <input
              type="number"
              required
              className="llm-form-input"
              value={formData.contextWindow}
              onChange={(e) =>
                setFormData({ ...formData, contextWindow: Number(e.target.value) })
              }
              placeholder="4096"
            />
            <span className="llm-form-hint">
              {isZh ? "最大令牌数" : "Max tokens"}
            </span>
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "输入价格" : "Input Price"} {isZh ? "（/1M）" : "(per 1M tokens)"}
            </label>
            <input
              type="number"
              step="0.001"
              className="llm-form-input"
              value={formData.inputPrice || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  inputPrice: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="0.01"
            />
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "输出价格" : "Output Price"} {isZh ? "（/1M）" : "(per 1M tokens)"}
            </label>
            <input
              type="number"
              step="0.001"
              className="llm-form-input"
              value={formData.outputPrice || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  outputPrice: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="0.03"
            />
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "标签" : "Tags"}
            </label>
            <div className="llm-tags-input">
              {formData.tags?.map((tag, idx) => (
                <span key={idx} className="llm-tag">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        tags: formData.tags?.filter((_, i) => i !== idx),
                      });
                    }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={isZh ? "输入后回车添加标签" : "Type and press Enter"}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      setFormData({
                        ...formData,
                        tags: [...(formData.tags || []), value],
                      });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="llm-form-group">
            <label className="llm-checkbox-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData({ ...formData, enabled: e.target.checked })
                }
              />
              <span>{isZh ? "启用此模型" : "Enable this model"}</span>
            </label>
          </div>

          <div className="llm-form-group">
            <label className="llm-checkbox-label">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
              />
              <span>{isZh ? "设为默认模型" : "Set as default model"}</span>
            </label>
          </div>

          <div className="llm-drawer-actions">
            <button
              type="button"
              className="llm-button llm-button--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {isZh ? "取消" : "Cancel"}
            </button>
            <button
              type="submit"
              className="llm-button llm-button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isZh
                  ? "保存中..."
                  : "Saving..."
                : isZh
                  ? "保存"
                  : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

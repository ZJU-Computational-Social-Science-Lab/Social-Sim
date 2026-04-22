// frontend/components/llm-console/ProviderFormModal.tsx
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Provider } from "../../services/providers";

type ProviderFormModalProps = {
  isOpen: boolean;
  editingProvider: Provider | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    provider: string;
    model: string;
    base_url?: string;
    api_key?: string;
  }) => Promise<void>;
};

export function ProviderFormModal({
  isOpen,
  editingProvider,
  onClose,
  onSubmit,
}: ProviderFormModalProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [formData, setFormData] = useState({
    name: "",
    provider: "openai-compatible",
    model: "",
    base_url: "",
    api_key: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (editingProvider) {
      setFormData({
        name: editingProvider.name,
        provider: editingProvider.provider,
        model: editingProvider.model,
        base_url: editingProvider.base_url || "",
        api_key: "",
      });
    } else {
      setFormData({
        name: "",
        provider: "openai-compatible",
        model: "",
        base_url: "",
        api_key: "",
      });
    }
  }, [editingProvider, isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="llm-modal-overlay">
      <div className="llm-modal">
        <div className="llm-modal-header">
          <h2 className="llm-modal-title">
            {editingProvider
              ? isZh
                ? "编辑 Provider"
                : "Edit Provider"
              : isZh
                ? "新增 Provider"
                : "New Provider"}
          </h2>
          <button className="llm-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="llm-modal-form">
          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "Provider 名称" : "Provider Name"} *
            </label>
            <input
              type="text"
              required
              className="llm-form-input"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={isZh ? "如：My OpenAI" : "e.g. My OpenAI"}
            />
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "Provider 类型" : "Provider Type"} *
            </label>
            <select
              className="llm-form-input"
              value={formData.provider}
              onChange={(e) =>
                setFormData({ ...formData, provider: e.target.value })
              }
            >
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="azure-openai">Azure OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "默认模型" : "Default Model"} *
            </label>
            <input
              type="text"
              required
              className="llm-form-input"
              value={formData.model}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
              placeholder={
                isZh ? "如：gpt-4-turbo" : "e.g. gpt-4-turbo"
              }
            />
          </div>

          {formData.provider !== "gemini" && (
            <div className="llm-form-group">
              <label className="llm-form-label">
                {isZh ? "Base URL" : "Base URL"}
              </label>
              <input
                type="url"
                className="llm-form-input"
                value={formData.base_url}
                onChange={(e) =>
                  setFormData({ ...formData, base_url: e.target.value })
                }
                placeholder={
                  isZh
                    ? "如：https://api.openai.com/v1"
                    : "e.g. https://api.openai.com/v1"
                }
              />
            </div>
          )}

          <div className="llm-form-group">
            <label className="llm-form-label">
              {isZh ? "API Key" : "API Key"} *
            </label>
            <div className="llm-form-input-group">
              <input
                type={showApiKey ? "text" : "password"}
                required
                className="llm-form-input"
                value={formData.api_key}
                onChange={(e) =>
                  setFormData({ ...formData, api_key: e.target.value })
                }
                placeholder={isZh ? "粘贴你的API密钥" : "Paste your API key"}
              />
              <button
                type="button"
                className="llm-form-visibility"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "隐藏" : isZh ? "显示" : "Show"}
              </button>
            </div>
          </div>

          <div className="llm-modal-actions">
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

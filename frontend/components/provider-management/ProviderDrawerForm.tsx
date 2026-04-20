// frontend/components/provider-management/ProviderDrawerForm.tsx
import { useEffect, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import type { Provider } from "../../services/providers";
import type { ProviderFormValues } from "./ProviderManagementPage";

type ProviderDrawerFormProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  provider: Provider | null;
  initialValues: ProviderFormValues;
  onClose: () => void;
  onSubmit: (values: ProviderFormValues) => void;
  isSaving: boolean;
};

export function ProviderDrawerForm({
  isOpen,
  mode,
  provider,
  initialValues,
  onClose,
  onSubmit,
  isSaving,
}: ProviderDrawerFormProps) {
  const [values, setValues] = useState<ProviderFormValues>(initialValues);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setValues(initialValues);
    setShowApiKey(false);
  }, [initialValues, isOpen]);

  if (!isOpen) return null;

  const isGemini = values.provider === "gemini";
  const title = mode === "create" ? "新增 LLM" : `编辑 LLM · ${provider?.name ?? ""}`;

  return (
    <div className="provider-drawer-shell" role="presentation" onClick={onClose}>
      <aside className="provider-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="provider-drawer__header">
          <div>
            <h2 className="provider-drawer__title">{title}</h2>
            <p className="provider-drawer__subtitle">
              {isGemini ? "Google Gemini 模型接入配置" : "OpenAI Compatible 模型接入配置"}
            </p>
          </div>
          <button type="button" className="provider-drawer__close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <form
          className="provider-drawer__form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="provider-form-grid">
            <label className="provider-field">
              <span className="provider-field__label">LLM 名称 *</span>
              <input
                className="provider-field__input"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                placeholder="如：OpenAI 主线路 / Gemini 备用"
                required
              />
            </label>

            <label className="provider-field">
              <span className="provider-field__label">Provider 类型 *</span>
              <select
                className="provider-field__input"
                value={values.provider}
                onChange={(event) => setValues((current) => ({ ...current, provider: event.target.value as ProviderFormValues["provider"] }))}
              >
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </label>

            {!isGemini ? (
              <label className="provider-field provider-field--full">
                <span className="provider-field__label">Base URL *</span>
                <input
                  className="provider-field__input"
                  value={values.base_url}
                  onChange={(event) => setValues((current) => ({ ...current, base_url: event.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  required
                />
              </label>
            ) : null}

            <label className="provider-field provider-field--full">
              <span className="provider-field__label">API Key *</span>
              <div className="provider-field__secret-row">
                <input
                  className="provider-field__input"
                  type={showApiKey ? "text" : "password"}
                  value={values.api_key}
                  onChange={(event) => setValues((current) => ({ ...current, api_key: event.target.value }))}
                  placeholder="••••••••••••••••"
                  required={mode === "create"}
                />
                <button type="button" className="provider-field__secret-toggle" onClick={() => setShowApiKey((current) => !current)}>
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="provider-field provider-field--full">
              <span className="provider-field__label">默认模型</span>
              <input
                className="provider-field__input"
                value={values.model}
                onChange={(event) => setValues((current) => ({ ...current, model: event.target.value }))}
                placeholder={isGemini ? "gemini-1.5-flash" : "gpt-4o-mini"}
              />
            </label>
          </div>

          <details className="provider-advanced">
            <summary className="provider-advanced__summary">高级设置</summary>
            <div className="provider-advanced__body">
              <div className="provider-advanced__grid">
                <label className="provider-field">
                  <span className="provider-field__label">Temperature</span>
                  <input
                    className="provider-field__input"
                    value={values.temperature}
                    onChange={(event) => setValues((current) => ({ ...current, temperature: event.target.value }))}
                    placeholder="如：0.7"
                    inputMode="decimal"
                  />
                </label>

                <label className="provider-field">
                  <span className="provider-field__label">Top P</span>
                  <input
                    className="provider-field__input"
                    value={values.top_p}
                    onChange={(event) => setValues((current) => ({ ...current, top_p: event.target.value }))}
                    placeholder="如：1.0"
                    inputMode="decimal"
                  />
                </label>

                <label className="provider-field">
                  <span className="provider-field__label">Max Tokens</span>
                  <input
                    className="provider-field__input"
                    value={values.max_tokens}
                    onChange={(event) => setValues((current) => ({ ...current, max_tokens: event.target.value }))}
                    placeholder="如：4096"
                    inputMode="numeric"
                  />
                </label>

                <label className="provider-field">
                  <span className="provider-field__label">响应格式</span>
                  <input
                    className="provider-field__input"
                    value={values.response_format}
                    onChange={(event) => setValues((current) => ({ ...current, response_format: event.target.value }))}
                    placeholder="如：json_object"
                  />
                </label>

                <label className="provider-field provider-field--full">
                  <span className="provider-field__label">Timeout (ms)</span>
                  <input
                    className="provider-field__input"
                    value={values.timeout_ms}
                    onChange={(event) => setValues((current) => ({ ...current, timeout_ms: event.target.value }))}
                    placeholder="如：60000"
                    inputMode="numeric"
                  />
                </label>
              </div>

              <label className="provider-field provider-field--full">
                <span className="provider-field__label">Custom Endpoint</span>
                <input
                  className="provider-field__input"
                  value={values.custom_endpoint}
                  onChange={(event) => setValues((current) => ({ ...current, custom_endpoint: event.target.value }))}
                  placeholder="可选"
                />
              </label>

              <label className="provider-field provider-field--full">
                <span className="provider-field__label">Headers / Metadata</span>
                <textarea
                  className="provider-field__textarea"
                  value={values.metadata}
                  onChange={(event) => setValues((current) => ({ ...current, metadata: event.target.value }))}
                  placeholder="可选"
                  rows={4}
                />
              </label>

              <p className="provider-advanced__hint">留空时将跟随后端或模型默认配置。</p>
            </div>
          </details>

          <div className="provider-drawer__footer">
            <button type="button" className="provider-button provider-button--ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="provider-button provider-button--primary" disabled={isSaving}>
              {isSaving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

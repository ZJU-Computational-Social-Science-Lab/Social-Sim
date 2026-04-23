// frontend/components/llm-console/TestConsolePanel.tsx
import { useState } from "react";
import { Play, Copy, Trash2, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Provider } from "../../services/providers";
import type { ModelRecord } from "../../services/models";

type TestConsolePanelProps = {
  providers: Provider[];
  models: ModelRecord[];
  activeModelId: string | null;
  testInput: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
    responseFormat: "text" | "json";
  };
  testResult: {
    status: "idle" | "loading" | "success" | "error";
    responseTime: number;
    tokensUsed?: { prompt: number; completion: number };
    content?: string;
    errorMessage?: string;
  };
  onSetActiveModel: (id: string) => void;
  onUpdateTestInput: (partial: any) => void;
  onSendTest: () => void;
  onClear: () => void;
  onTestConnection: () => void;
  isTestConnecting?: boolean;
  isTestSending?: boolean;
};

export function TestConsolePanel({
  providers,
  models,
  activeModelId,
  testInput,
  testResult,
  onSetActiveModel,
  onUpdateTestInput,
  onSendTest,
  onClear,
  onTestConnection,
  isTestConnecting = false,
  isTestSending = false,
}: TestConsolePanelProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [expandSystemPrompt, setExpandSystemPrompt] = useState(false);
  const [expandErrorLog, setExpandErrorLog] = useState(false);

  const activeModel = models.find((m) => m.id === activeModelId);
  const activeProvider = activeModel
    ? providers.find((p) => p.id === activeModel.providerId)
    : null;

  const handleCopyResult = () => {
    if (testResult.content) {
      navigator.clipboard.writeText(testResult.content);
    }
  };

  return (
    <div className="llm-test-console">
      <div className="llm-console-header">
        <h3 className="llm-console-title">
          {isZh ? "测试控制台" : "Test Console"}
        </h3>
        <div className="llm-console-model-badge">
          {activeModel ? (
            <>
              <span className="llm-badge-text">{activeModel.displayName}</span>
            </>
          ) : (
            <span className="llm-badge-text llm-text-muted">
              {isZh ? "未选择模型" : "No model selected"}
            </span>
          )}
        </div>
      </div>

      {/* 模型选择 */}
      <div className="llm-console-section">
        <label className="llm-console-label">
          {isZh ? "选择模型" : "Select Model"}
        </label>
        <select
          className="llm-console-select"
          value={activeModelId || ""}
          onChange={(e) => onSetActiveModel(e.target.value)}
        >
          <option value="">
            {isZh ? "选择要测试的模型..." : "Choose a model to test..."}
          </option>
          {models.filter((m) => m.enabled).map((model) => (
            <option key={model.id} value={model.id || ""}>
              {model.displayName} ({model.modelId}) · {model.providerId}
            </option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div className="llm-console-section">
        <button
          className="llm-console-label llm-expandable-header"
          onClick={() => setExpandSystemPrompt(!expandSystemPrompt)}
        >
          <ChevronDown
            size={14}
            style={{
              transform: expandSystemPrompt ? "rotate(180deg)" : "none",
            }}
          />
          <span>{isZh ? "系统提示词" : "System Prompt"}</span>
        </button>
        {expandSystemPrompt && (
          <textarea
            className="llm-console-textarea"
            value={testInput.systemPrompt}
            onChange={(e) =>
              onUpdateTestInput({ systemPrompt: e.target.value })
            }
            rows={4}
            placeholder={
              isZh
                ? "输入系统提示词..."
                : "Enter system prompt..."
            }
          />
        )}
      </div>

      {/* User Prompt */}
      <div className="llm-console-section">
        <label className="llm-console-label">
          {isZh ? "用户提示词" : "User Prompt"} *
        </label>
        <textarea
          className="llm-console-textarea"
          value={testInput.userPrompt}
          onChange={(e) =>
            onUpdateTestInput({ userPrompt: e.target.value })
          }
          rows={5}
          placeholder={
            isZh ? "输入测试提示词..." : "Enter test prompt..."
          }
        />
      </div>

      {/* 参数 */}
      <div className="llm-console-params">
        <div className="llm-param-group">
          <label className="llm-param-label">
            {isZh ? "Temperature" : "Temperature"}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={testInput.temperature}
            onChange={(e) =>
              onUpdateTestInput({ temperature: Number(e.target.value) })
            }
            className="llm-param-slider"
          />
          <span className="llm-param-value">{testInput.temperature.toFixed(1)}</span>
        </div>

        <div className="llm-param-group">
          <label className="llm-param-label">
            {isZh ? "最大 Tokens" : "Max Tokens"}
          </label>
          <input
            type="number"
            min="1"
            max="8000"
            value={testInput.maxTokens}
            onChange={(e) =>
              onUpdateTestInput({ maxTokens: Number(e.target.value) })
            }
            className="llm-param-number"
          />
        </div>

        <div className="llm-param-group">
          <label className="llm-param-label">
            {isZh ? "响应格式" : "Response Format"}
          </label>
          <select
            value={testInput.responseFormat}
            onChange={(e) =>
              onUpdateTestInput({
                responseFormat: e.target.value as "text" | "json",
              })
            }
            className="llm-param-select"
          >
            <option value="text">Text</option>
            <option value="json">JSON</option>
          </select>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="llm-console-actions">
        <button
          className="llm-button llm-button--secondary llm-button--sm"
          onClick={onTestConnection}
          disabled={isTestConnecting || !activeProvider}
          title={isZh ? "测试 Provider 连接" : "Test provider connection"}
        >
          {isTestConnecting ? (
            <>
              <span className="llm-spinner" />
              <span>{isZh ? "连接中..." : "Testing..."}</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>{isZh ? "测试连接" : "Test Connection"}</span>
            </>
          )}
        </button>

        <button
          className="llm-button llm-button--primary llm-button--sm"
          onClick={onSendTest}
          disabled={isTestSending || !activeModel || !testInput.userPrompt}
          title={isZh ? "发送测试" : "Send test"}
        >
          {isTestSending ? (
            <>
              <span className="llm-spinner" />
              <span>{isZh ? "发送中..." : "Sending..."}</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>{isZh ? "发送测试" : "Send Test"}</span>
            </>
          )}
        </button>

        <button
          className="llm-button llm-button--secondary llm-button--sm"
          onClick={onClear}
          disabled={!testInput.userPrompt && testResult.status === "idle"}
          title={isZh ? "清空" : "Clear"}
        >
          <Trash2 size={12} />
          <span>{isZh ? "清空" : "Clear"}</span>
        </button>
      </div>

      {/* 结果展示 */}
      {testResult.status !== "idle" && (
        <div className="llm-console-result">
          <div
            className={`llm-result-header llm-result-header--${testResult.status}`}
          >
            <span className="llm-result-status">
              {testResult.status === "loading"
                ? isZh
                  ? "处理中..."
                  : "Processing..."
                : testResult.status === "success"
                  ? isZh
                    ? "✓ 成功"
                    : "✓ Success"
                  : isZh
                    ? "✗ 失败"
                    : "✗ Failed"}
            </span>
            <span className="llm-result-time">
              {testResult.responseTime.toFixed(2)}ms
              {testResult.tokensUsed && (
                <>
                  {" "}
                  · {testResult.tokensUsed.prompt} +{" "}
                  {testResult.tokensUsed.completion}
                </>
              )}
            </span>
          </div>

          {testResult.content && (
            <div className="llm-result-content">
              <div className="llm-result-actions-bar">
                <button
                  className="llm-icon-button llm-icon-button--sm"
                  onClick={handleCopyResult}
                  title={isZh ? "复制" : "Copy"}
                >
                  <Copy size={12} />
                </button>
              </div>
              <pre className="llm-result-text">{testResult.content}</pre>
            </div>
          )}

          {testResult.errorMessage && (
            <div className="llm-console-section">
              <button
                className="llm-console-label llm-expandable-header"
                onClick={() => setExpandErrorLog(!expandErrorLog)}
              >
                <ChevronDown
                  size={14}
                  style={{
                    transform: expandErrorLog ? "rotate(180deg)" : "none",
                  }}
                />
                <span>{isZh ? "错误日志" : "Error Log"}</span>
              </button>
              {expandErrorLog && (
                <pre className="llm-error-log">{testResult.errorMessage}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* 提示信息 */}
      {!activeModel && (
        <div className="llm-console-hint">
          <p>
            {isZh
              ? "请先选择一个模型进行测试"
              : "Select a model to start testing"}
          </p>
        </div>
      )}
    </div>
  );
}

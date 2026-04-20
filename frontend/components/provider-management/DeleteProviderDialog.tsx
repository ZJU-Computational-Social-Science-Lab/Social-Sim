// frontend/components/provider-management/DeleteProviderDialog.tsx
import type { Provider } from "../../services/providers";

type DeleteProviderDialogProps = {
  provider: Provider | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
};

export function DeleteProviderDialog({
  provider,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteProviderDialogProps) {
  if (!isOpen || !provider) return null;

  return (
    <div className="provider-dialog-overlay" role="presentation" onClick={onClose}>
      <div className="provider-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3 className="provider-dialog__title">删除 LLM 配置</h3>
        <p className="provider-dialog__description">
          确认删除 <strong>{provider.name}</strong> 的 LLM 配置？此操作无法撤销。
        </p>
        <div className="provider-dialog__actions">
          <button type="button" className="provider-button provider-button--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="provider-button provider-button--danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "删除中…" : "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

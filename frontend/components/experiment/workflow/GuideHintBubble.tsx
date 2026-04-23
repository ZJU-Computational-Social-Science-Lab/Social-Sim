import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GuideHintBubbleProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

export const GuideHintBubble: React.FC<GuideHintBubbleProps> = ({
  message,
  actionLabel,
  onAction,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  return (
    <div className="ss-guide-hint">
      <p>{message}</p>
      <div className="ss-guide-hint__actions">
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="ss-guide-hint__link"
          >
            {actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="ss-guide-hint__close"
          aria-label={isZh ? "关闭提示" : "Dismiss hint"}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default GuideHintBubble;

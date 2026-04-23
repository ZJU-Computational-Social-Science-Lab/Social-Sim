import React from "react";
import { Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GuideMascotTriggerProps {
  open: boolean;
  hasNotice?: boolean;
  onClick: () => void;
}

export const GuideMascotTrigger: React.FC<GuideMascotTriggerProps> = ({
  open,
  hasNotice,
  onClick,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`ss-guide-trigger${open ? " is-open" : ""}`.trim()}
      aria-label={isZh ? "打开流程引导" : "Open workflow guide"}
    >
      <span className="ss-guide-trigger__icon" aria-hidden="true">
        <Bookmark size={18} />
      </span>
      {hasNotice ? <span className="ss-guide-trigger__notice" aria-hidden="true" /> : null}
    </button>
  );
};

export default GuideMascotTrigger;

// frontend/components/provider-management/ProviderPageHeader.tsx
import { Plus } from "lucide-react";

type ProviderPageHeaderProps = {
  title: string;
  subtitle: string;
  onAdd: () => void;
};

export function ProviderPageHeader({ title, subtitle, onAdd }: ProviderPageHeaderProps) {
  return (
    <header className="provider-page-header">
      <div className="provider-page-header__copy">
        <h1 className="provider-page-header__title">{title}</h1>
        <p className="provider-page-header__subtitle">{subtitle}</p>
      </div>

      <button type="button" className="provider-button provider-button--primary" onClick={onAdd}>
        <Plus size={16} />
        <span>新增 LLM</span>
      </button>
    </header>
  );
}

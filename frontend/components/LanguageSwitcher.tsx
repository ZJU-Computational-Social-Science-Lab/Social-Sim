import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function LanguageSwitcher() {
  const { i18n: i18 } = useTranslation();
  const current = i18.language.startsWith('zh') ? 'zh' : 'en';
  const [open, setOpen] = useState(false);
  const label = current === 'zh' ? '中文' : 'EN';

  return (
    <div className="lang-switch">
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="lang-button"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            🌐 {label} <span style={{ marginLeft: 6, color: 'var(--muted)' }}>▾</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="card select-dropdown"
            align="end"
            sideOffset={4}
            style={{ minWidth: 'var(--radix-popper-anchor-width)' }}
          >
            <DropdownMenu.Item className={`menu-item ${current === 'en' ? 'active' : ''}`} onSelect={() => setLanguage('en')}>
              EN
            </DropdownMenu.Item>
            <DropdownMenu.Item className={`menu-item ${current === 'zh' ? 'active' : ''}`} onSelect={() => setLanguage('zh')}>
              中文
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

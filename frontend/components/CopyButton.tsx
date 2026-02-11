import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardIcon, CheckIcon } from '@radix-ui/react-icons';

export function CopyButton({ text }: { text: string }) {
    const { t } = useTranslation();
    const [isCopied, setIsCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);

        setTimeout(() => {
            setIsCopied(false);
        }, 2500);
    };

    const Icon = isCopied ? CheckIcon : ClipboardIcon;

    return (
        <button
            disabled={isCopied}
            onClick={copy}
            className="code-copy-button"
            style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                zIndex: 1,
                padding: '4px 8px',
                background: 'hsla(0, 0%, 50%, 0.2)',
                border: '1px solid hsla(0, 0%, 50%, 0.3)',
                color: 'var(--text)',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
            }}
        >
            <Icon style={{ width: 14, height: 14 }} />
            <span>{isCopied ? t('components.copyButton.copied') : t('components.copyButton.copy')}</span>
        </button>
    );
}

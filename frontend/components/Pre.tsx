import { CopyButton } from './CopyButton';

export function Pre({ children, raw, ...props }: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement> & { raw?: string }) {
    return (
        <div className="code-block-wrapper" style={{ position: 'relative' }}>
            <pre {...props}>{children}</pre>
            {raw && <CopyButton text={raw} />}
        </div>
    );
}

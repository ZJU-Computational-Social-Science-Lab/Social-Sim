// frontend/components/provider-management/ProviderStatusBadge.tsx
type ProviderStatusBadgeProps = {
  status?: string | null;
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  success: { label: "已连接", className: "is-success" },
  failed: { label: "失败", className: "is-error" },
  pending: { label: "测试中", className: "is-pending" },
};

export function ProviderStatusBadge({ status }: ProviderStatusBadgeProps) {
  const entry = status ? STATUS_MAP[status] : null;
  const label = entry?.label ?? "未测试";
  const className = entry?.className ?? "is-muted";

  return (
    <span className={`provider-status-badge ${className}`}>
      <span className="provider-status-badge__dot" />
      <span>{label}</span>
    </span>
  );
}

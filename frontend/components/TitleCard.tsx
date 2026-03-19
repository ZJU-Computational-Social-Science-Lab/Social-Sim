import { ReactNode } from "react";

export function TitleCard({
  title,
  subtitle,
  actions,
  center,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  center?: ReactNode;
  eyebrow?: ReactNode;
}) {
  const hasCenter = Boolean(center);

  return (
    <section className="page-hero title-card">
      <div
        className="page-hero__header"
        style={{
          gridTemplateColumns: hasCenter ? "1fr minmax(0, 1fr) auto" : undefined,
        }}
      >
        <div className="flex min-w-0 flex-col gap-3">
          {eyebrow ? <div className="page-hero__eyebrow">{eyebrow}</div> : null}
          <div className="page-hero__title">{title}</div>
          {subtitle ? <div className="text-subtitle max-w-3xl">{subtitle}</div> : null}
        </div>

        {hasCenter ? <div className="w-full max-w-xl justify-self-center">{center}</div> : null}

        {actions ? <div className="flex flex-wrap justify-end gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

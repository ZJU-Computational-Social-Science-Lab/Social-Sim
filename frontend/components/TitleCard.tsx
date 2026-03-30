import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function TitleCard({
  title,
  subtitle,
  actions,
  center,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  center?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const hasCenter = Boolean(center);
  const isZh = i18n.language.startsWith("zh");
  return (
    <div
      className="panel title-card"
      style={{
        marginBottom: "1rem",
        display: "grid",
        alignItems: "center",
        gap: "0.9rem",
        gridTemplateColumns: hasCenter ? "1fr minmax(0, 2fr) auto" : "1fr auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="kicker">{isZh ? "研究工作台" : "Research Workbench"}</div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 2.4vw, 3rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.04em",
            color: "var(--heading)",
            fontWeight: 650,
          }}
        >
          {title}
        </h1>
        {subtitle && <div className="panel-subtitle">{subtitle}</div>}
      </div>
      {hasCenter && (
        <div style={{ justifySelf: "center", width: "100%", maxWidth: 560 }}>{center}</div>
      )}
      {actions && (
        <div style={{ justifySelf: "end", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>{actions}</div>
      )}
    </div>
  );
}


// frontend/pages/DocsPage.tsx
import React from "react";
import { TitleCard } from "../components/TitleCard";
import { useTranslation } from 'react-i18next';

export function DocsPage() {
  const { t } = useTranslation();

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        padding: "1rem 1.5rem",
        boxSizing: "border-box",
      }}
    >
      <TitleCard title={t('pages.docsPage.documentation')} />

      <div className="panel" style={{ gap: "0.75rem" }}>
        <div className="panel-title">{t('pages.docsPage.notIntegrated')}</div>

        <div className="card" style={{ lineHeight: 1.6, fontSize: "0.95rem" }}>
          <p dangerouslySetInnerHTML={{ __html: t('pages.docsPage.placeholderText') }} />

          <p>
            {t('pages.docsPage.youCanStillUse')}
          </p>
          <ul style={{ paddingLeft: "1.2rem", marginTop: "0.4rem" }}>
            <li>{t('pages.docsPage.featureLogin')}</li>
            <li>{t('pages.docsPage.featureDashboard')}</li>
            <li>{t('pages.docsPage.featureSimulation')}</li>
            <li>{t('pages.docsPage.featureSettings')}</li>
          </ul>

          <p style={{ marginTop: "0.8rem" }}>
            {t('pages.docsPage.futureRestore')}
          </p>
          <ol style={{ paddingLeft: "1.2rem", marginTop: "0.4rem" }}>
            <li dangerouslySetInnerHTML={{ __html: t('pages.docsPage.futureStep1') }} />
            <li dangerouslySetInnerHTML={{ __html: t('pages.docsPage.futureStep2') }} />
          </ol>

          <p style={{ marginTop: "0.8rem", color: "#64748b" }} dangerouslySetInnerHTML={{ __html: t('pages.docsPage.currentGoal') }} />
        </div>
      </div>
    </div>
  );
}

export default DocsPage;

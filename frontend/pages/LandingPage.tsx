import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function LandingPage() {
  const { t } = useTranslation();
  return (
    <section className="panel" style={{ maxWidth: 960, margin: "0 auto", gap: "0.75rem" }}>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: 0 }}>{t('landing.headline')}</h1>
      <p style={{ fontSize: "1rem", color: "var(--muted)", margin: 0 }}>{t('landing.sub')}</p>
      <p style={{ fontSize: "0.95rem", color: "var(--muted)", margin: 0 }}>
        {t('landing.learn', { name: t('brand') })}
        {/* fallback direct link */}
        <a
          href="https://github.com/f1sherb0y/socialsim4"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--link)" }}
        >
          {t('brand')}
        </a>
        .
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Link to="/simulations/new" className="button">{t('landing.ctaNew')}</Link>
        <Link to="/login" className="button button-ghost">{t('landing.ctaResume')}</Link>
      </div>
    </section>
  );
}

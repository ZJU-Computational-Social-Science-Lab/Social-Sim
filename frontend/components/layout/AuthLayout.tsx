import { Atom, MoonStar, SunMedium } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LanguageSwitcher } from "../LanguageSwitcher";
import { useThemeStore } from "../../store/theme";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const mode = useThemeStore((state) => state.mode);
  const toggle = useThemeStore((state) => state.toggle);
  const isZh = i18n.language.startsWith("zh");
  const themeClass = mode === "dark" ? "is-dark" : "is-light";
  const themeToggleLabel =
    mode === "dark"
      ? isZh
        ? "切换到日间模式"
        : "Switch to light mode"
      : isZh
        ? "切换到夜间模式"
        : "Switch to dark mode";

  return (
    <div className={`ss-auth ${themeClass}`.trim()}>
      <div className="ss-auth-shell">
        <header className="ss-auth__topbar">
          <Link to="/" className="ss-auth__topbar-brand">
            <div className="ss-auth__brand-mark">
              <Atom size={18} />
            </div>
            <span className="ss-auth__brand-link">FOS</span>
          </Link>

          <div className="ss-auth__topbar-controls">
            <button
              type="button"
              className="ss-auth__utility-button"
              onClick={toggle}
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
            >
              {mode === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
            </button>
            <LanguageSwitcher variant="product" />
          </div>
        </header>

        <section className="ss-auth__hero">
          <div className="ss-auth__hero-grid" />
          <div className="ss-auth__hero-content">
            <div className="ss-auth__hero-body">
              <div className="ss-auth__hero-badge">
                <span className="ss-auth__hero-badge-dot" />
                {t("auth.layout.badge")}
              </div>

              <div className="space-y-5">
                <h1 className="ss-auth__hero-title">
                  <span className="ss-auth__hero-title-line">{t("auth.layout.line1")}</span>
                  <span className="ss-auth__hero-title-line">{t("auth.layout.line2")}</span>
                  <span className="ss-auth__hero-title-accent">{t("auth.layout.accent")}</span>
                </h1>
                <p className="ss-auth__hero-copy">{t("auth.layout.copy")}</p>
              </div>
            </div>

            <div className="ss-auth__hero-tags">
              <span className="ss-auth__hero-tag">{t("auth.layout.tag1")}</span>
              <span className="ss-auth__hero-tag">{t("auth.layout.tag2")}</span>
              <span className="ss-auth__hero-tag">{t("auth.layout.tag3")}</span>
            </div>

            <div className="ss-auth__hero-surface">
              <div className="ss-auth__hero-surface-kicker">{t("auth.layout.surfaceLabel")}</div>
              <div className="ss-auth__hero-surface-grid">
                <div className="ss-auth__hero-surface-item">
                  <div className="ss-auth__hero-surface-title">{t("auth.layout.surface1Title")}</div>
                  <p className="ss-auth__hero-surface-copy">{t("auth.layout.surface1Body")}</p>
                </div>
                <div className="ss-auth__hero-surface-item">
                  <div className="ss-auth__hero-surface-title">{t("auth.layout.surface2Title")}</div>
                  <p className="ss-auth__hero-surface-copy">{t("auth.layout.surface2Body")}</p>
                </div>
                <div className="ss-auth__hero-surface-item">
                  <div className="ss-auth__hero-surface-title">{t("auth.layout.surface3Title")}</div>
                  <p className="ss-auth__hero-surface-copy">{t("auth.layout.surface3Body")}</p>
                </div>
              </div>
            </div>

            <div className="ss-auth__hero-note">
              {t("auth.layout.note")}
            </div>
          </div>
        </section>

        <section className="ss-auth__panel">
          <div className="ss-auth__panel-shell">{children}</div>
        </section>
      </div>
    </div>
  );
}

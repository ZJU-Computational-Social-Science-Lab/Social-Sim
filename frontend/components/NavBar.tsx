import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";

export function NavBar() {
  const location = useLocation();
  const { t } = useTranslation();

  // ✅ 这里是“安全版方案二”：分别读取字段，不在 selector 里 new 对象
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearSession = useAuthStore((s) => s.clearSession);

  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  const navItems = [
    { to: "/dashboard", label: t("nav.dashboard") },
    { to: "/simulations/new", label: t("nav.new") },
    { to: "/simulations/saved", label: t("nav.saved") },
    { to: "/settings/providers", label: t("nav.settings") },
    { to: "/docs", label: t("nav.docs") || "Docs" },
  ];

  return (
    <nav className="nav">
      <div className="nav-left">
        <Link to="/" className="nav-brand">
          {t("brand")}
        </Link>

        <div className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link ${
                location.pathname.startsWith(item.to) ? "active" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}

          {String((user as any)?.role || "") === "admin" && (
            <Link
              to="/admin"
              className={`nav-link ${
                location.pathname.startsWith("/admin") ? "active" : ""
              }`}
            >
              {t("nav.admin") || "Admin"}
            </Link>
          )}
        </div>
      </div>

      <div className="nav-right">
        <button
          type="button"
          className="icon-button"
          onClick={toggle}
          title={t('components.navBar.toggleTheme')}
        >
          {mode === "dark" ? "🌙" : "☀️"}
        </button>

        <LanguageSwitcher />

        {isAuthenticated ? (
          <div className="nav-user">
            <span className="nav-username">
              {String((user as any)?.email ?? "")}
            </span>
            <button
              type="button"
              className="text-button"
              onClick={clearSession}
            >
              {t("nav.signout")}
            </button>
          </div>
        ) : (
          <div className="nav-user">
            <Link to="/login" className="nav-link">
              {t("nav.login")}
            </Link>
            <Link to="/register" className="nav-link">
              {t("nav.register")}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

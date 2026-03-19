import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  User,
} from "lucide-react";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

export function NavBar() {
  const location = useLocation();
  const { t } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const clearSession = useAuthStore((state) => state.clearSession);

  const mode = useThemeStore((state) => state.mode);
  const toggle = useThemeStore((state) => state.toggle);

  const navItems: NavItem[] = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/simulations/new", label: t("nav.new"), icon: <Sparkles className="h-4 w-4" /> },
    { to: "/simulations/saved", label: t("nav.saved"), icon: <BookOpen className="h-4 w-4" /> },
    { to: "/settings/providers", label: t("nav.settings"), icon: <Settings2 className="h-4 w-4" /> },
    { to: "/docs", label: t("nav.docs") || "Docs", icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <nav className="product-nav">
      <div className="product-nav__inner">
        <Link to="/" className="product-brand">
          <div className="product-brand__mark">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="product-brand__title">{t("brand")}</span>
            <span className="product-brand__meta">Calm Social Simulation</span>
          </div>
        </Link>

        <div className="product-nav__rail no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`product-nav__link ${isActive ? "active" : ""}`.trim()}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="product-nav__actions">
          <button
            type="button"
            className="icon-button square"
            onClick={toggle}
            title={t("components.navBar.toggleTheme")}
          >
            {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <LanguageSwitcher />

          <span className="product-divider" />

          {isAuthenticated ? (
            <>
              <div className="hidden items-center gap-3 sm:flex">
                <div className="product-avatar">
                  <User className="h-4 w-4 text-[var(--sim-text-muted)]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[var(--sim-text-strong)]">
                    {String((user as any)?.email ?? "").split("@")[0]}
                  </span>
                  <span className="text-xs text-[var(--sim-text-soft)]">
                    {String((user as any)?.role ?? "member")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="icon-button square"
                onClick={clearSession}
                title={t("nav.signout")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="button-ghost button-sm">
                {t("nav.login")}
              </Link>
              <Link to="/register" className="button button-sm">
                {t("nav.register")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

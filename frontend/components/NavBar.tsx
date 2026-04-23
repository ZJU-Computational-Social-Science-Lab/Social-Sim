import { useEffect, useState } from "react";
import { Menu, MoonStar, SunMedium, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useSimulationStore } from "../store";
import { useAuthStore } from "../store/auth";
import { useThemeStore } from "../store/theme";

const DESKTOP_BREAKPOINT_QUERY = "(min-width: 961px)";

export type NavBarVariant = "default" | "product";

export function NavBar({ variant = "default" }: { variant?: NavBarVariant }) {
  const location = useLocation();
  const { t } = useTranslation();
  const [compactOpen, setCompactOpen] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearSession = useAuthStore((s) => s.clearSession);
  const currentSimulationId = useSimulationStore((s) => s.currentSimulation?.id ?? null);

  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  const isProduct = variant === "product";
  const isAdmin = String(user?.role ?? "") === "admin";
  const workspaceLink = currentSimulationId ? `/simulations/${currentSimulationId}` : "/simulations/workspace";
  const navItems = [
    { id: "dashboard", to: "/dashboard", label: t("nav.dashboard") },
    { id: "new", to: "/simulations/new", label: t("nav.new") },
    { id: "workspace", to: workspaceLink, label: t("nav.workspace", { defaultValue: "实验台" }) },
    { id: "saved", to: "/simulations/saved", label: t("nav.saved") },
    { id: "settings", to: "/settings", label: t("nav.settings") },
    { id: "docs", to: "/docs", label: t("nav.docs") || "Docs" },
  ];
  const allNavItems = isAdmin
    ? [...navItems, { id: "admin", to: "/admin", label: t("nav.admin") || "Admin" }]
    : navItems;
  const themeIcon =
    isProduct
      ? mode === "dark"
        ? <MoonStar size={16} strokeWidth={2.1} />
        : <SunMedium size={16} strokeWidth={2.1} />
      : mode === "dark"
        ? "🌙"
        : "☀️";

  useEffect(() => {
    setCompactOpen(false);
  }, [location.pathname, variant]);

  useEffect(() => {
    if (!isProduct) {
      return;
    }

    const media = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    const closeCompact = () => {
      if (media.matches) {
        setCompactOpen(false);
      }
    };

    closeCompact();
    media.addEventListener("change", closeCompact);

    return () => media.removeEventListener("change", closeCompact);
  }, [isProduct]);

  const isNavItemActive = (itemId: string, itemTo: string) => {
    if (itemId === "dashboard") {
      return location.pathname.startsWith("/dashboard");
    }

    if (itemId === "new") {
      return location.pathname.startsWith("/simulations/new");
    }

    if (itemId === "workspace") {
      return (
        location.pathname === "/simulations/workspace" ||
        (location.pathname.startsWith("/simulations/") &&
          !location.pathname.startsWith("/simulations/new") &&
          !location.pathname.startsWith("/simulations/saved"))
      );
    }

    if (itemId === "saved") {
      return location.pathname.startsWith("/simulations/saved");
    }

    if (itemId === "settings") {
      return location.pathname.startsWith("/settings");
    }

    if (itemId === "docs") {
      return location.pathname.startsWith("/docs");
    }

    return location.pathname.startsWith(itemTo);
  };

  const renderNavLinks = (extraClass = "") =>
    allNavItems.map((item) => (
      <Link
        key={item.id}
        to={item.to}
        className={`nav-link ${extraClass} ${
          isNavItemActive(item.id, item.to) ? "active" : ""
        }`.trim()}
      >
        {item.label}
      </Link>
    ));

  return (
    <nav className={`nav ${isProduct ? "nav--product" : ""} ${compactOpen ? "nav--product-open" : ""}`}>
      <div className="nav-shell">
        <div className="nav-left">
          <Link to="/" className="nav-brand">
            <BrandLogo />
          </Link>

          <div className="nav-links nav-links--desktop">
            {renderNavLinks()}
          </div>
        </div>

        <div className="nav-right">
          <div className="nav-utilities">
            <button
              type="button"
              className={`icon-button ${isProduct ? "icon-button--product square" : ""}`}
              onClick={toggle}
              title={t("components.navBar.toggleTheme")}
            >
              {themeIcon}
            </button>

            <LanguageSwitcher variant={isProduct ? "product" : "default"} />
          </div>

          {isProduct ? <div className="nav-divider nav-divider--desktop" /> : null}

          <div className={`nav-session ${isProduct ? "nav-session--desktop" : ""}`}>
            {isAuthenticated ? (
              <div className={`nav-user ${isProduct ? "nav-user--product" : ""}`}>
                <span className="nav-username">
                  {String(user?.email ?? "")}
                </span>
                <button
                  type="button"
                  className={`text-button ${isProduct ? "nav-signout" : ""}`}
                  onClick={clearSession}
                >
                  {t("nav.signout")}
                </button>
              </div>
            ) : (
              <div className={`nav-auth ${isProduct ? "nav-auth--product" : ""}`}>
                <Link
                  to="/login"
                  className={isProduct ? "nav-auth-link nav-auth-link--login" : "nav-link"}
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to="/register"
                  className={isProduct ? "nav-auth-link nav-auth-link--register" : "nav-link"}
                >
                  {t("nav.register")}
                </Link>
              </div>
            )}
          </div>

          {isProduct ? (
            <button
              type="button"
              className="icon-button icon-button--product square nav-menu-toggle"
              onClick={() => setCompactOpen((open) => !open)}
              aria-expanded={compactOpen}
              aria-controls="product-nav-panel"
              aria-label={compactOpen ? t("common.hide") : t("common.show")}
              title={compactOpen ? t("common.hide") : t("common.show")}
            >
              {compactOpen ? <X size={17} strokeWidth={2.1} /> : <Menu size={17} strokeWidth={2.1} />}
            </button>
          ) : null}
        </div>
      </div>

      {isProduct ? (
        <div
          id="product-nav-panel"
          className={`nav-mobile ${compactOpen ? "nav-mobile--open" : ""}`}
          aria-hidden={!compactOpen}
        >
          <div className="nav-mobile-shell">
            <div className="nav-mobile-links">{renderNavLinks("nav-link--mobile")}</div>

            {isAuthenticated ? (
              <div className="nav-mobile-session nav-mobile-session--user">
                <span className="nav-mobile-email">{String(user?.email ?? "")}</span>
                <button type="button" className="nav-mobile-signout" onClick={clearSession}>
                  {t("nav.signout")}
                </button>
              </div>
            ) : (
              <div className="nav-mobile-session">
                <Link to="/login" className="nav-auth-link nav-auth-link--login">
                  {t("nav.login")}
                </Link>
                <Link to="/register" className="nav-auth-link nav-auth-link--register">
                  {t("nav.register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  Moon,
  Orbit,
  Settings,
  Sun,
} from "lucide-react";
import { useSimulationStore } from "../store";
import { useAuthStore } from "../store/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useThemeStore } from "../store/theme";

interface SimulationWorkspaceChromeProps {
  observationMode: "global" | "focused" | "compare";
  selectedAgentName?: string | null;
  workspaceMode: "observation" | "control";
  onChangeWorkspaceMode: (mode: "observation" | "control") => void;
}

export const SimulationWorkspaceChrome: React.FC<SimulationWorkspaceChromeProps> = ({
  observationMode,
  selectedAgentName = null,
  workspaceMode,
  onChangeWorkspaceMode,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const currentSim = useSimulationStore((state) => state.currentSimulation);
  const nodes = useSimulationStore((state) => state.nodes);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const engineConfig = useSimulationStore((state) => state.engineConfig);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.clearSession);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null,
    [nodes, selectedNodeId]
  );

  const sceneConfig = ((currentSim as any)?.scene_config || {}) as Record<string, any>;
  const subtitle =
    sceneConfig.description ||
    sceneConfig.initial_event ||
    (currentSim as any)?.description ||
    t("simulationWorkspace.subtitleFallback");
  const workspaceTitle = React.useMemo(() => {
    const rawTitle = currentSim?.name || t("simulationWorkspace.titleFallback");
    const [primaryTitle] = rawTitle.split(/\s[-–—]\s/);
    return primaryTitle?.trim() || rawTitle;
  }, [currentSim?.name, t]);

  const observationModeLabel =
    observationMode === "compare"
      ? t("controlRoom.modeCompare")
      : observationMode === "focused"
        ? t("controlRoom.modeFocused")
        : t("controlRoom.modeGlobal");

  return (
    <div className="ss-workspace__chrome">
      <div className="ss-workspace__topbar">
        <div className="flex flex-wrap items-center gap-4">
          <div className="ss-workspace__brand">
            <div className="ss-workspace__brand-mark">
              <Orbit size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-[var(--ss-workspace-heading)]">
                SocialSim4
              </div>
              <div className="text-[11px] tracking-[0.08em] text-[var(--ss-workspace-muted)]">
                {isZh ? "仿真控制台" : "Simulation Control Room"}
              </div>
            </div>
          </div>

          <nav className="ss-workspace__nav">
            <Link to="/dashboard" className="ss-workspace__nav-link">
              {t("nav.dashboard")}
            </Link>
            <Link to="/simulations/new" className="ss-workspace__nav-link">
              {t("nav.new")}
            </Link>
            <Link to="/simulations/saved" className="ss-workspace__nav-link">
              {t("nav.saved")}
            </Link>
            <Link to="/settings" className="ss-workspace__nav-link">
              {t("nav.settings")}
            </Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleTheme}
            className="ss-icon-button"
            title={t("components.navBar.toggleTheme")}
          >
            {themeMode === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <LanguageSwitcher />
          <Link to="/settings" className="ss-icon-button" title={t("nav.settings")}>
            <Settings size={16} />
          </Link>
          <div className="ss-pill ss-pill--quiet">{user?.email}</div>
          <button onClick={logout} className="ss-icon-button" title={t("nav.signout")}>
            <LogOut size={14} />
            <span className="hidden sm:inline">{t("nav.signout")}</span>
          </button>
        </div>
      </div>

      <div className="ss-workspace__hero ss-workspace__hero--compact">
        <div className="ss-workspace__hero-row">
          <div className="max-w-5xl space-y-4">
            <div className="ss-kicker">{t("simulationWorkspace.deskLabel")}</div>
            <div>
              <h1 className="ss-workspace__hero-title">
                {workspaceTitle}
              </h1>
              <p className="ss-workspace__hero-copy">{subtitle}</p>
            </div>

            <div className="ss-workspace__hero-pills">
              <span className="ss-pill ss-pill--quiet">
                {engineConfig.mode === "connected"
                  ? t("simulationWorkspace.autosaveCloud")
                  : t("simulationWorkspace.autosaveLocal")}
              </span>
              {selectedNode ? (
                <span className="ss-pill ss-pill--quiet">
                  {t("simulationWorkspace.metrics.branch")}: {selectedNode.display_id}
                </span>
              ) : null}
              <span className="ss-pill ss-pill--active">{observationModeLabel}</span>
              {selectedAgentName ? (
                <span className="ss-pill ss-pill--quiet">{selectedAgentName}</span>
              ) : null}
            </div>
          </div>

          <div className="ss-workspace__mode-switch">
            <button
              type="button"
              className={`ss-workspace__mode-chip${workspaceMode === "observation" ? " is-active" : ""}`}
              onClick={() => onChangeWorkspaceMode("observation")}
            >
              {isZh ? "观察模式" : "Observation mode"}
            </button>
            <button
              type="button"
              className={`ss-workspace__mode-chip${workspaceMode === "control" ? " is-active" : ""}`}
              onClick={() => onChangeWorkspaceMode("control")}
            >
              {isZh ? "高级控制" : "Control mode"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationWorkspaceChrome;

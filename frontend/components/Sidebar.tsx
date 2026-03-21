import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Zap } from "lucide-react";
import { useSimulationStore } from "../store";
import { AgentPanel } from "./AgentPanel";
import { HostPanel } from "./HostPanel";

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"agents" | "host">("agents");
  const agents = useSimulationStore((state) => state.agents);

  return (
    <aside className="ss-workspace__panel ss-workspace__panel--observation h-full">
      <div className="ss-workspace__panel-header">
        <div className="ss-kicker">{t("simulationWorkspace.stageTitle")}</div>
        <h2 className="ss-workspace__panel-title mt-2">{t("components.sidebar.agents")}</h2>
        <p className="ss-workspace__panel-copy">{t("components.sidebar.overviewHint")}</p>
      </div>

      <div className="border-b border-[var(--ss-workspace-border)] px-4 py-3">
        <div className="ss-workspace__tabs">
          <button
            onClick={() => setActiveTab("agents")}
            className={`ss-workspace__tab ${activeTab === "agents" ? "is-active" : ""}`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users size={15} />
              <span className="truncate">{t("components.sidebar.agents")}</span>
              <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px]">{agents.length}</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("host")}
            className={`ss-workspace__tab ${activeTab === "host" ? "is-active" : ""}`}
          >
            <div className="flex items-center justify-center gap-2">
              <Zap size={15} />
              <span>{t("components.sidebar.hostControl")}</span>
            </div>
          </button>
        </div>
      </div>

      <div className="ss-workspace__panel-body">
        {activeTab === "agents" ? <AgentPanel /> : <HostPanel />}
      </div>
    </aside>
  );
};

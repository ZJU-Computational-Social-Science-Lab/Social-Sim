import React from "react";
import { ArrowRight, Brain, BookOpen, ChevronLeft, Sparkles, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useSimulationStore } from "../../store";

interface AgentObservationPanelProps {
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  onHide: () => void;
}

type AgentStatusTone = "active" | "processing" | "idle" | "complete";

const summarizeText = (text: string, fallback: string) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
};

export const AgentObservationPanel: React.FC<AgentObservationPanelProps> = ({
  selectedAgentId,
  onSelectAgent,
  onHide,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const agents = useSimulationStore((state) => state.agents);
  const logs = useSimulationStore((state) => state.logs);

  const latestByAgent = React.useMemo(() => {
    const map = new Map<string, { content: string; round: number }>();
    for (let index = logs.length - 1; index >= 0; index -= 1) {
      const entry = logs[index];
      if (!entry.agentId || map.has(entry.agentId)) {
        continue;
      }
      map.set(entry.agentId, {
        content: summarizeText(entry.content, isZh ? "暂无最新活动。" : "No recent activity."),
        round: entry.round,
      });
    }
    return map;
  }, [isZh, logs]);

  const activeAgentId = React.useMemo(() => {
    for (let index = logs.length - 1; index >= 0; index -= 1) {
      const entry = logs[index];
      if (entry.agentId) {
        return entry.agentId;
      }
    }
    return null;
  }, [logs]);

  const selectedAgent = React.useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId],
  );

  const getAgentStatus = React.useCallback(
    (agentId: string): { label: string; tone: AgentStatusTone } => {
      if (selectedAgentId === agentId) {
        return { label: isZh ? "观察中" : "Focused", tone: "active" };
      }
      if (activeAgentId === agentId) {
        return { label: isZh ? "处理中" : "Processing", tone: "processing" };
      }
      if (latestByAgent.has(agentId)) {
        return { label: isZh ? "已完成" : "Complete", tone: "complete" };
      }
      return { label: isZh ? "空闲" : "Idle", tone: "idle" };
    },
    [activeAgentId, isZh, latestByAgent, selectedAgentId],
  );

  return (
    <section className="ss-agent-observation" id="workspace-agents">
      <div className="ss-agent-observation__header">
        <div>
          <div className="ss-kicker">{isZh ? "参与者观察" : "Agent observation"}</div>
          <h2>{isZh ? "默认可见的参与者观察面板" : "Default-visible participant observation"}</h2>
        </div>
        <div className="ss-agent-observation__header-actions">
          <span className="ss-agent-observation__count">
            {agents.length}
            <small>{isZh ? "位参与者" : "agents"}</small>
          </span>
          <button
            type="button"
            className="ss-icon-button"
            onClick={onHide}
            title={isZh ? "隐藏参与者观察" : "Hide agent observation"}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="ss-agent-observation__list">
        {agents.length ? (
          agents.map((agent) => {
            const latest = latestByAgent.get(agent.id);
            const status = getAgentStatus(agent.id);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className={`ss-agent-observation__card${selectedAgentId === agent.id ? " is-selected" : ""}`}
              >
                <div className="ss-agent-observation__card-top">
                  <div className="ss-agent-observation__identity">
                    <img src={agent.avatarUrl} alt={agent.name} className="ss-agent-observation__avatar" />
                    <div>
                      <strong>{agent.name}</strong>
                      <span>{agent.role || (isZh ? "参与当前实验" : "Active in simulation")}</span>
                    </div>
                  </div>
                  <span className={`ss-agent-observation__state is-${status.tone}`}>{status.label}</span>
                </div>

                <p className="ss-agent-observation__copy">
                  {latest?.content || summarizeText(agent.profile, isZh ? "等待新的推演结果。" : "Waiting for new simulation output.")}
                </p>

                <div className="ss-agent-observation__footer">
                  <span>
                    {isZh ? "记忆" : "Memory"} {agent.memory.length}
                  </span>
                  <span>
                    {isZh ? "知识" : "Knowledge"} {agent.knowledgeBase.length}
                  </span>
                  <span className="ss-agent-observation__detail-link">
                    {isZh ? "查看详情" : "View details"}
                    <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            );
          })
        ) : (
              <div className="ss-agent-observation__empty">
            {isZh ? "当前还没有可观察的参与者，继续推演或加载实验后会显示参与者。"
            : "No agents are visible yet. Continue the simulation or load an experiment to populate this panel."}
          </div>
        )}
      </div>

      {selectedAgent ? (
        <div className="ss-agent-drawer">
          <div className="ss-agent-drawer__backdrop" onClick={() => onSelectAgent(null)} />
          <aside className="ss-agent-drawer__panel">
            <div className="ss-agent-drawer__header">
              <div>
                <div className="ss-kicker">{isZh ? "参与者详情" : "Agent details"}</div>
                <h3>{selectedAgent.name}</h3>
                <p>{selectedAgent.role || (isZh ? "参与当前实验推演" : "Participant in the simulation")}</p>
              </div>
              <button type="button" className="ss-icon-button" onClick={() => onSelectAgent(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="ss-agent-drawer__body">
              <div className="ss-agent-drawer__metric-grid">
                <div className="ss-agent-drawer__metric">
                  <UserRound size={15} />
                  <div>
                    <span>{isZh ? "状态" : "State"}</span>
                    <strong>{getAgentStatus(selectedAgent.id).label}</strong>
                  </div>
                </div>
                <div className="ss-agent-drawer__metric">
                  <Brain size={15} />
                  <div>
                    <span>{isZh ? "记忆条目" : "Memory items"}</span>
                    <strong>{selectedAgent.memory.length}</strong>
                  </div>
                </div>
                <div className="ss-agent-drawer__metric">
                  <BookOpen size={15} />
                  <div>
                    <span>{isZh ? "知识条目" : "Knowledge items"}</span>
                    <strong>{selectedAgent.knowledgeBase.length}</strong>
                  </div>
                </div>
                <div className="ss-agent-drawer__metric">
                  <Sparkles size={15} />
                  <div>
                    <span>{isZh ? "模型" : "Model"}</span>
                    <strong>{selectedAgent.llmConfig.model || "—"}</strong>
                  </div>
                </div>
              </div>

              <div className="ss-agent-drawer__section">
                <span>{isZh ? "职责摘要" : "Role summary"}</span>
                <p>{selectedAgent.profile || (isZh ? "暂无额外职责描述。" : "No additional role summary yet.")}</p>
              </div>

              <div className="ss-agent-drawer__section">
                <span>{isZh ? "最新活动" : "Latest activity"}</span>
                <p>{latestByAgent.get(selectedAgent.id)?.content || (isZh ? "还没有新的事件记录。" : "No recent event yet.")}</p>
              </div>

              <div className="ss-agent-drawer__section">
                <span>{isZh ? "关键属性" : "Key properties"}</span>
                <div className="ss-agent-drawer__property-list">
                  {Object.entries(selectedAgent.properties || {}).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="ss-agent-drawer__property">
                      <strong>{key}</strong>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                  {!Object.keys(selectedAgent.properties || {}).length ? (
                    <div className="ss-agent-drawer__property is-empty">
                      {isZh ? "当前没有额外属性。" : "No additional properties yet."}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
};

export default AgentObservationPanel;

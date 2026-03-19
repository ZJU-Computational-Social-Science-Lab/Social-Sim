import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, FileText, Users } from "lucide-react";

import { useExperimentBuilder } from "../../store/experiment-builder";

interface PromptPreviewPanelProps {
  agentTypeLabel: string;
  agentTypeProfile: string;
  agentTypeRolePrompt: string;
  agentTypeProperties: Record<string, unknown>;
  scenarioDescription: string;
  scenarioParams: Record<string, unknown>;
  availableActions: Array<{ name: string; description: string }>;
  selectedActionIds: string[];
}

const PromptPreviewPanel: React.FC<PromptPreviewPanelProps> = ({
  agentTypeLabel,
  agentTypeProfile,
  agentTypeRolePrompt,
  agentTypeProperties,
  scenarioDescription,
  scenarioParams,
  availableActions,
  selectedActionIds,
}) => {
  const selectedActions = availableActions.filter((action) =>
    selectedActionIds.includes(action.name),
  );

  const formatParamKey = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  const previewProperties = Object.entries(agentTypeProperties || {}).filter(
    ([key]) => !["avatarUrl", "llm_config", "provider_id"].includes(key),
  );

  return (
    <div className="studio-field-group !gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
            Prompt preview
          </div>
          <div className="mt-2 text-[1.1rem] font-bold text-[var(--sim-text-strong)]">
            {agentTypeLabel}
          </div>
        </div>
        <span className="badge badge-outline">{selectedActions.length} actions</span>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.46)] dark:bg-[rgba(255,255,255,0.02)]">
        <div className="border-b border-[var(--sim-border)] px-5 py-4">
          <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
            Launch-time document view
          </div>
        </div>
        <div className="space-y-5 px-5 py-5 font-mono text-sm text-[var(--sim-text)]">
          <section>
            <div className="font-semibold text-[var(--sim-text-strong)]">Agent</div>
            <div className="mt-2 leading-7">
              You are {agentTypeLabel}. {agentTypeRolePrompt} {agentTypeProfile}
            </div>
          </section>

          {previewProperties.length > 0 ? (
            <section>
              <div className="font-semibold text-[var(--sim-text-strong)]">Properties</div>
              <div className="mt-2 space-y-1 text-[var(--sim-text-muted)]">
                {previewProperties.map(([key, value]) => (
                  <div key={key}>
                    - {formatParamKey(key)}: {String(value)}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="font-semibold text-[var(--sim-text-strong)]">Scenario</div>
            <div className="mt-2 leading-7 text-[var(--sim-text-muted)]">
              {scenarioDescription || "No scenario description provided."}
            </div>
          </section>

          <section>
            <div className="font-semibold text-[var(--sim-text-strong)]">Parameters</div>
            <div className="mt-2 space-y-1 text-[var(--sim-text-muted)]">
              {Object.keys(scenarioParams).length > 0 ? (
                Object.entries(scenarioParams).map(([key, value]) => (
                  <div key={key}>
                    - {formatParamKey(key)}: {String(value)}
                  </div>
                ))
              ) : (
                <div>None configured.</div>
              )}
            </div>
          </section>

          <section>
            <div className="font-semibold text-[var(--sim-text-strong)]">Available actions</div>
            <div className="mt-2 space-y-1 text-[var(--sim-text-muted)]">
              {selectedActions.length > 0 ? (
                selectedActions.map((action) => (
                  <div key={action.name}>
                    - {action.name}: {action.description}
                  </div>
                ))
              ) : (
                <div>No actions selected.</div>
              )}
            </div>
          </section>

          <section>
            <div className="font-semibold text-[var(--sim-text-strong)]">Expected response</div>
            <div className="mt-2 text-[var(--sim-text-muted)]">
              Respond with JSON only. Choose one action from{" "}
              {selectedActions.map((action) => action.name).join(", ") || "the configured action space"}.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export const Step6Structure: React.FC = () => {
  const { t } = useTranslation();
  const {
    agentTypes,
    scenarioDescription,
    scenarioParams,
    availableActions,
    selectedActionIds,
    selectedScenarioData,
    socialNetwork,
  } = useExperimentBuilder();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    agentTypes[0]?.id || null,
  );

  const totalAgents = agentTypes.reduce((sum, agent) => sum + agent.count, 0);
  const totalLinks = useMemo(() => {
    const seen = new Set<string>();
    Object.entries(socialNetwork || {}).forEach(([source, targets]) => {
      targets.forEach((target) => {
        const key = source < target ? `${source}|${target}` : `${target}|${source}`;
        seen.add(key);
      });
    });
    return seen.size;
  }, [socialNetwork]);

  const selectedAgent =
    agentTypes.find((agent) => agent.id === selectedAgentId) || agentTypes[0] || null;

  if (agentTypes.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(196,107,114,0.12)] text-[var(--sim-danger)]">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-[var(--sim-text-strong)]">
            {t("experimentBuilder.step6.noAgentsDefined")}
          </h3>
          <p className="mt-2 text-sm text-[var(--sim-text-muted)]">
            {t("experimentBuilder.step6.goBackToStep4")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="studio-pane-grid two">
        <div className="studio-field-group">
          <div className="page-hero__eyebrow w-fit">
            <FileText className="h-3.5 w-3.5" />
            Launch summary
          </div>
          <div className="text-[1.3rem] font-bold text-[var(--sim-text-strong)]">
            Final review before the experiment starts.
          </div>
          <div className="text-sm leading-7 text-[var(--sim-text-muted)]">
            This screen is the last chance to confirm the world description, action grammar,
            agent population, and prompt shape each participant receives.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="studio-field-group !p-4">
            <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
              Scenario
            </div>
            <div className="text-lg font-bold text-[var(--sim-text-strong)]">
              {selectedScenarioData?.name || "Custom"}
            </div>
          </div>
          <div className="studio-field-group !p-4">
            <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
              Agents
            </div>
            <div className="text-lg font-bold text-[var(--sim-text-strong)]">{totalAgents}</div>
          </div>
          <div className="studio-field-group !p-4">
            <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--sim-text-soft)]">
              Network links
            </div>
            <div className="text-lg font-bold text-[var(--sim-text-strong)]">{totalLinks}</div>
          </div>
        </div>
      </section>

      <section className="studio-field-group">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-[var(--sim-text-strong)]">Agent type previews</div>
            <div className="mt-1 text-sm text-[var(--sim-text-muted)]">
              Switch between configured agent types to inspect what each one sees.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {agentTypes.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className={`button-ghost button-sm ${selectedAgent?.id === agent.id ? "!bg-[var(--sim-primary-soft)] !border-[var(--sim-border-strong)] !text-[var(--sim-primary)]" : ""}`.trim()}
                onClick={() => setSelectedAgentId(agent.id)}
              >
                {agent.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedAgent ? (
        <PromptPreviewPanel
          agentTypeLabel={selectedAgent.label}
          agentTypeProfile={selectedAgent.userProfile || ""}
          agentTypeRolePrompt={selectedAgent.rolePrompt || ""}
          agentTypeProperties={selectedAgent.properties || {}}
          scenarioDescription={scenarioDescription}
          scenarioParams={scenarioParams}
          availableActions={availableActions}
          selectedActionIds={selectedActionIds}
        />
      ) : null}

      <section className="studio-field-group">
        <div className="flex items-center gap-2 text-[var(--sim-text-strong)]">
          <Users className="h-4 w-4" />
          <span className="font-bold">Launch checklist</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-[18px] border border-[var(--sim-border)] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-[var(--sim-success)]" />
            <span className="text-sm text-[var(--sim-text-muted)]">Scenario and description ready</span>
          </div>
          <div className="flex items-center gap-3 rounded-[18px] border border-[var(--sim-border)] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-[var(--sim-success)]" />
            <span className="text-sm text-[var(--sim-text-muted)]">Action space configured</span>
          </div>
          <div className="flex items-center gap-3 rounded-[18px] border border-[var(--sim-border)] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-[var(--sim-success)]" />
            <span className="text-sm text-[var(--sim-text-muted)]">Agent types configured</span>
          </div>
          <div className="flex items-center gap-3 rounded-[18px] border border-[var(--sim-border)] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-[var(--sim-success)]" />
            <span className="text-sm text-[var(--sim-text-muted)]">Network preview reviewed</span>
          </div>
        </div>
      </section>
    </div>
  );
};

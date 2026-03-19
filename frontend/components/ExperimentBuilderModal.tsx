import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import { useExperimentBuilder } from "../store/experiment-builder";
import { useSimulationStore } from "../store";
import { ExperimentBuilder } from "./experiment/ExperimentBuilder";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface LaunchDeps {
  t: TranslateFn;
  addSimulation: ReturnType<typeof useSimulationStore.getState>["addSimulation"];
  addNotification: ReturnType<typeof useSimulationStore.getState>["addNotification"];
}

export function launchExperimentFromBuilderState({
  t,
  addSimulation,
  addNotification,
}: LaunchDeps) {
  const state = useExperimentBuilder.getState();

  const scenarioName = state.selectedScenarioData?.name || t("experimentBuilder.newExperiment");
  const scenarioDescription = state.scenarioDescription || "";

  let name = scenarioName;
  if (scenarioDescription) {
    const trimmed =
      scenarioDescription.length > 30
        ? `${scenarioDescription.substring(0, 30)}...`
        : scenarioDescription;
    name = `${scenarioName} - ${trimmed}`;
  }

  const convertAgentToSimulationAgent = (agentType: any) => {
    const count = agentType.count || 1;
    const props = agentType.properties || {};
    const agents = [];

    for (let i = 0; i < count; i += 1) {
      const rolePrompt = agentType.rolePrompt?.trim() || null;
      const userProfile = agentType.userProfile?.trim() || "";
      const suffix = count > 1 ? ` ${i + 1}` : "";
      const idSuffix = count > 1 ? `-${i}` : "";
      const avatarUrl =
        (props.avatarUrl as string) ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(agentType.label || "agent")}${i}`;

      const providerId = agentType.providerId ?? state.selectedProviderId;
      const selectedProvider = state.llmProviders.find((provider) => provider.id === providerId);
      const llmConfig = selectedProvider
        ? {
            provider: selectedProvider.provider,
            model: selectedProvider.model || "default",
          }
        : {
            provider: "backend",
            model: "default",
          };

      agents.push({
        name: `${agentType.label}${suffix}`,
        id: `${agentType.id}${idSuffix}`,
        role: rolePrompt || "",
        role_prompt: rolePrompt,
        profile: userProfile || rolePrompt || "",
        user_profile: userProfile || "",
        avatarUrl,
        llm_config: llmConfig,
        provider_id: providerId,
        properties: {
          ...props,
          avatarUrl,
        },
        history: {},
        memory: [],
        knowledgeBase: [],
        score: 0,
      });
    }

    return agents;
  };

  const customAgents = state.agentTypes.flatMap(convertAgentToSimulationAgent);

  const selectedActionObjects = (state.availableActions || []).filter((action: any) =>
    state.selectedActionIds.includes(action.name),
  );

  const scenarioData = state.selectedScenarioData;
  const resolvedDescription =
    scenarioDescription.trim().length > 0
      ? scenarioDescription
      : scenarioData?.description || t("experimentBuilder.customExperiment");

  const genericConfig: any = {
    description: resolvedDescription,
    scenario_id: state.selectedScenarioId || "custom",
    actions: selectedActionObjects.map((action: any) => ({
      name: action.name,
      description: action.description || action.name,
    })),
    parameters: state.scenarioParams || {},
    round_visibility: state.roundVisibility || "simultaneous",
  };

  const isPolicyCascade =
    scenarioData?.id === "policy_diffusion" ||
    scenarioData?.id === "policyDiffusion" ||
    (scenarioData?.name || "").toLowerCase().includes("policy") ||
    (scenarioData?.name || "").includes("政策");

  const isNewArchitecture =
    scenarioData?.category === "game_theory" ||
    scenarioData?.category === "discussion" ||
    scenarioData?.category === "grid" ||
    scenarioData?.category === "social_dynamics" ||
    scenarioData?.category === "social_deduction" ||
    scenarioData?.category === "spatial";

  addSimulation(
    name,
    {
      id: "experiment-template",
      name,
      description: resolvedDescription,
      category: (scenarioData?.category || "custom") as const,
      sceneType: isPolicyCascade
        ? "policy_cascade_scene"
        : isNewArchitecture
          ? "experiment"
          : "generic",
      agents: customAgents,
      defaultTimeConfig: {
        baseTime: new Date().toISOString(),
        unit: "hour" as const,
        step: 1,
      },
      genericConfig,
      defaultNetwork: state.socialNetwork || {},
    },
    undefined,
    undefined,
  );

  addNotification?.("success", t("experimentBuilder.experimentCreated"));
}

interface ExperimentBuilderModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: (config: unknown) => void;
}

export const ExperimentBuilderModal: React.FC<ExperimentBuilderModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation();
  const isWizardOpen = useSimulationStore((state) => state.isWizardOpen);
  const toggleWizard = useSimulationStore((state) => state.toggleWizard);
  const addSimulation = useSimulationStore((state) => state.addSimulation);
  const addNotification = useSimulationStore((state) => state.addNotification);

  const useExplicitState = isOpen !== undefined;
  const isModalOpen = useExplicitState ? isOpen : isWizardOpen;

  useEffect(() => {
    if (isModalOpen) {
      useExperimentBuilder.getState().reset();
    }
  }, [isModalOpen]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      toggleWizard(false);
    }
  };

  const handleComplete = () => {
    launchExperimentFromBuilderState({ t, addSimulation, addNotification });
    onComplete?.({});
    handleClose();
  };

  if (!isModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,14,22,0.56)] px-4 py-6 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-[32px] border border-[var(--sim-border)] bg-[var(--sim-bg)] shadow-[var(--sim-shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--sim-border)] px-6 py-4">
          <div>
            <div className="page-hero__eyebrow">Modal studio</div>
            <div className="mt-3 text-lg font-bold text-[var(--sim-text-strong)]">
              {t("experimentBuilder.modalTitle")}
            </div>
          </div>
          <button type="button" className="icon-button square" onClick={handleClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-82px)] overflow-y-auto">
          <ExperimentBuilder onComplete={handleComplete} onCancel={handleClose} />
        </div>
      </div>
    </div>
  );
};

export default ExperimentBuilderModal;

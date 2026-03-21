import React from "react";
import { useTranslation } from "react-i18next";
import { GitFork, Info, X } from "lucide-react";

import { useSimulationStore } from "../../store";
import type { SimNode } from "../../types";

type BranchKind = "parallel" | "compare" | "perturbation" | "custom";

type BranchDraft = {
  name: string;
  branchType: BranchKind;
  inheritCurrentState: boolean;
  notes: string;
};

const GENERIC_NODE_PATTERN = /^(Node \d+|节点 \d+)$/;

const getNodeLabel = (node: SimNode | null, t: (key: string, options?: any) => string) => {
  if (!node) return "—";
  if (node.depth === 0) return "Start";
  if (node.name && !GENERIC_NODE_PATTERN.test(node.name)) return node.name;
  return t("controlRoom.roundNodeLabel", { round: node.depth });
};

interface BranchComposerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BranchComposerDialog: React.FC<BranchComposerDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const nodes = useSimulationStore((state) => state.nodes);
  const selectedNodeId = useSimulationStore((state) => state.selectedNodeId);
  const branchSimulation = useSimulationStore((state) => state.branchSimulation);
  const isGenerating = useSimulationStore((state) => state.isGenerating);

  const selectedNode = React.useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId],
  );

  const selectedLabel = getNodeLabel(selectedNode, t);
  const [branchDraft, setBranchDraft] = React.useState<BranchDraft>({
    name: "",
    branchType: "parallel",
    inheritCurrentState: true,
    notes: "",
  });

  React.useEffect(() => {
    if (!isOpen || !selectedNode) return;
    setBranchDraft({
      name: t("controlRoom.defaultBranchName", { name: selectedLabel }),
      branchType: "parallel",
      inheritCurrentState: true,
      notes: "",
    });
  }, [isOpen, selectedLabel, selectedNode, t]);

  const branchTypeOptions = React.useMemo(
    () => [
      { id: "parallel" as const, label: t("controlRoom.branchTypeParallel"), copy: t("controlRoom.branchTypeParallelCopy") },
      { id: "compare" as const, label: t("controlRoom.branchTypeCompare"), copy: t("controlRoom.branchTypeCompareCopy") },
      { id: "perturbation" as const, label: t("controlRoom.branchTypePerturbation"), copy: t("controlRoom.branchTypePerturbationCopy") },
      { id: "custom" as const, label: t("controlRoom.branchTypeCustom"), copy: t("controlRoom.branchTypeCustomCopy") },
    ],
    [t],
  );

  const handleCreateBranch = async () => {
    if (!selectedNode || !branchDraft.name.trim()) return;
    await branchSimulation({
      name: branchDraft.name.trim(),
      branchType: branchDraft.branchType,
      inheritCurrentState: branchDraft.inheritCurrentState,
      notes: branchDraft.notes.trim(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="ss-path__composer-backdrop" onClick={onClose}>
      <div className="ss-path__composer" onClick={(event) => event.stopPropagation()}>
        <div className="ss-path__composer-header">
          <div>
            <div className="ss-kicker">{t("controlRoom.createBranchDialogKicker")}</div>
            <h3>{t("controlRoom.createBranchDialogTitle")}</h3>
            <p>{t("controlRoom.createBranchDialogCopy")}</p>
          </div>
          <button onClick={onClose} className="ss-icon-button square" title={t("common.close")}>
            <X size={16} />
          </button>
        </div>

        <div className="ss-path__composer-body">
          <div className="ss-path__composer-field">
            <label>{t("controlRoom.sourceNode")}</label>
            <div className="ss-path__composer-readonly">
              <strong>{selectedLabel}</strong>
              <span>{selectedNode?.display_id || "—"}</span>
            </div>
          </div>

          <div className="ss-path__composer-field">
            <label htmlFor="branch-name">{t("controlRoom.branchName")}</label>
            <input
              id="branch-name"
              className="ss-input"
              value={branchDraft.name}
              onChange={(event) => setBranchDraft((draft) => ({ ...draft, name: event.target.value }))}
              placeholder={t("controlRoom.branchNamePlaceholder")}
            />
          </div>

          <div className="ss-path__composer-field">
            <label>{t("controlRoom.branchType")}</label>
            <div className="ss-path__composer-type-grid">
              {branchTypeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setBranchDraft((draft) => ({ ...draft, branchType: option.id }))}
                  className={`ss-path__composer-type ${branchDraft.branchType === option.id ? "is-active" : ""}`}
                >
                  <strong>{option.label}</strong>
                  <span>{option.copy}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ss-path__composer-field">
            <label>{t("controlRoom.inheritCurrentState")}</label>
            <div className="ss-path__composer-readonly ss-path__composer-readonly--toggle">
              <input type="checkbox" checked={branchDraft.inheritCurrentState} readOnly />
              <div>
                <strong>{t("controlRoom.inheritCurrentStateEnabled")}</strong>
                <span>{t("controlRoom.inheritCurrentStateFixed")}</span>
              </div>
            </div>
          </div>

          <div className="ss-path__composer-field">
            <label htmlFor="branch-notes">{t("controlRoom.branchNotes")}</label>
            <textarea
              id="branch-notes"
              className="ss-input ss-path__composer-notes"
              value={branchDraft.notes}
              onChange={(event) => setBranchDraft((draft) => ({ ...draft, notes: event.target.value }))}
              placeholder={t("controlRoom.branchNotesPlaceholder")}
            />
          </div>

          <div className="ss-path__composer-help">
            <Info size={15} />
            <span>{t("controlRoom.branchSafeHint")}</span>
          </div>
        </div>

        <div className="ss-path__composer-actions">
          <button onClick={onClose} className="ss-button-secondary">
            {t("common.cancel")}
          </button>
          <button
            onClick={() => void handleCreateBranch()}
            disabled={!branchDraft.name.trim() || isGenerating}
            className="ss-button"
          >
            <GitFork size={15} />
            {t("controlRoom.createAndRun")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchComposerDialog;

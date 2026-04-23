import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layers3, Sparkles } from "lucide-react";

import { useThemeStore } from "../store/theme";
import { useExperimentBuilder } from "../store/experiment-builder";
import { useSimulationStore } from "../store";
import { ExperimentBuilder } from "../components/experiment/ExperimentBuilder";
import { launchExperimentFromBuilderState } from "../components/ExperimentBuilderModal";

export function CreateExperimentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const applyTheme = useThemeStore((state) => state.apply);
  const addSimulation = useSimulationStore((state) => state.addSimulation);
  const addNotification = useSimulationStore((state) => state.addNotification);
  const currentSimulation = useSimulationStore((state) => state.currentSimulation);

  const {
    reset,
    setCurrentStep,
  } = useExperimentBuilder();

  const [isLaunching, setIsLaunching] = useState(false);
  const previousSimulationIdRef = useRef<string | null>(currentSimulation?.id ?? null);

  useEffect(() => {
    applyTheme();
    reset();
    setCurrentStep(1);
  }, [applyTheme, reset]);

  useEffect(() => {
    if (!isLaunching) return;
    if (!currentSimulation?.id) return;
    if (currentSimulation.id === previousSimulationIdRef.current) return;
    navigate(`/simulations/${currentSimulation.id}`);
  }, [currentSimulation?.id, isLaunching, navigate]);

  const handleLaunch = () => {
    previousSimulationIdRef.current = currentSimulation?.id ?? null;
    setIsLaunching(true);
    launchExperimentFromBuilderState({ t, addSimulation, addNotification });
  };

  return (
    <div className="studio-page">
      <ExperimentBuilder
        onCancel={() => navigate("/dashboard")}
        onComplete={handleLaunch}
      />
    </div>
  );
}

export default CreateExperimentPage;

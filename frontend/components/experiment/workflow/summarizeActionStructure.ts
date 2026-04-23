// Produces a short human-readable label describing the action set structure.
export const summarizeActionStructure = (
  actions: string[],
  isZh: boolean,
  minimumActionCount = 2
): string => {
  if (actions.length < minimumActionCount) {
    return isZh ? "动作不足" : "Too few actions";
  }

  if (minimumActionCount === 1) {
    return isZh ? "单动作场景" : "Single-action scene";
  }

  const source = actions.join(" ").toLowerCase();
  if (/cooperate|合作|协作/.test(source) && /defect|背叛|betray|竞争/.test(source)) {
    return isZh ? "对抗型双动作" : "Contrastive two-action set";
  }

  if (actions.length <= 4) {
    return isZh ? "紧凑策略集合" : "Compact strategy set";
  }

  return isZh ? "扩展策略集合" : "Expanded strategy set";
};

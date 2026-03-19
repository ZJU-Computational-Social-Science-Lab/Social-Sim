/**
 * Step 4: Agent Design
 *
 * Users design agents through three modes:
 * - Manual: Define agent types manually (for small experiments)
 * - Demographic: Generate agents from demographic variables with custom dimensions
 * - Import: Upload CSV/JSON files
 *
 * The demographic mode uses the flexible user-customizable approach
 * from the original SimulationWizard design.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useExperimentBuilder, ManualAgentType, LLMProvider } from '../../store/experiment-builder';
import { generateAgentsWithDemographics, isZh } from '../../store/helpers';
import { Step2DemographicsEditor, Demographic, Archetype, TraitConfig } from '../wizard/Step2DemographicsEditor';
import type { Agent } from '../../types';
import { Button } from '../ui/button';

type TierValue = string;

// =============================================================================
// Helper Functions
// =============================================================================

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const normalizeTierValue = (value: string): TierValue => {
  const normalized = value.toLowerCase().replace(/[\s_-]/g, '');
  if (normalized.includes('top') || normalized.includes('high') || value.includes('高层')) return 'top';
  if (normalized.includes('mid') || normalized.includes('middle') || value.includes('中层')) return 'mid';
  if (normalized.includes('low') || normalized.includes('base') || value.includes('基层')) return 'low';
  return '';
};

const inferTierFromAgent = (agent: Partial<ManualAgentType>): TierValue => {
  const explicitTier = normalizeTierValue(String(agent.properties?.tier || ''));
  if (explicitTier) return explicitTier;
  return normalizeTierValue([
    agent.label || '',
    agent.rolePrompt || '',
    agent.userProfile || '',
  ].join(' '));
};

const parseTierOrder = (rawValue: unknown): string[] => {
  const values = Array.isArray(rawValue)
    ? rawValue.map((item) => String(item).trim())
    : String(rawValue || 'top, mid, low')
      .split(/[\n,，]+/)
      .map((item) => item.trim());

  const cleaned: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(value);
  });
  return cleaned.length > 0 ? cleaned : ['top', 'mid', 'low'];
};

const inferOrderedTier = (agent: Partial<ManualAgentType>, tierOrder: string[]): string => {
  const explicit = String(agent.properties?.tier || '').trim();
  if (explicit) {
    const matched = tierOrder.find((tier) => tier.toLowerCase() === explicit.toLowerCase());
    if (matched) return matched;
  }

  const profileTier = String(agent.properties?.['政治职位层级'] || '').trim();
  if (profileTier) {
    const matched = tierOrder.find((tier) => tier.toLowerCase() === profileTier.toLowerCase());
    if (matched) return matched;
  }

  const normalizedTier = inferTierFromAgent(agent);
  if (!normalizedTier) return '';
  const matched = tierOrder.find((tier) => normalizeTierValue(tier) === normalizedTier);
  return matched || '';
};

const defaultTierName = (index: number): string => {
  if (index === 0) return 'top';
  if (index === 1) return 'mid';
  if (index === 2) return 'low';
  return `level_${index + 1}`;
};

const resizeTierOrder = (current: string[], count: number): string[] => {
  const nextCount = Math.max(2, count || 2);
  const next: string[] = [];
  for (let i = 0; i < nextCount; i += 1) {
    next.push(current[i] || defaultTierName(i));
  }
  return next;
};

const isPolicyCascadeScenario = (scenarioId: string, scenarioName: string): boolean => {
  return (
    scenarioId === 'policy_diffusion' ||
    scenarioId === 'policyDiffusion' ||
    scenarioName.includes('policy') ||
    scenarioName.includes('政策')
  );
};

// Generate archetypes from demographics (cross-product)
const generateArchetypes = (demographics: Demographic[]): Archetype[] => {
  if (demographics.length === 0) return [];

  let combinations: Record<string, string>[] = demographics[0].categories.map((cat) => ({
    [demographics[0].name]: cat,
  }));

  for (let i = 1; i < demographics.length; i++) {
    const demo = demographics[i];
    const newCombos: Record<string, string>[] = [];
    for (const combo of combinations) {
      for (const cat of demo.categories) {
        newCombos.push({ ...combo, [demo.name]: cat });
      }
    }
    combinations = newCombos;
  }

  const equalProb = 1 / combinations.length;
  return combinations.map((attrs, idx) => ({
    id: `arch_${idx}`,
    attributes: attrs,
    label: Object.entries(attrs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | '),
    probability: equalProb,
  }));
};

// =============================================================================
// Component
// =============================================================================

export const Step4Agents: React.FC = () => {
  const { t } = useTranslation();
  const {
    agentMode,
    setAgentMode,
    agentTypes,
    addAgentType,
    removeAgentType,
    updateAgentType,
    llmProviders,
    selectedProviderId,
    setSelectedProviderId,
    scenarioParams,
    setScenarioParams,
    loadProviders,
    getSelectedProviderId,
    selectedScenarioId,
    selectedScenarioData,
  } = useExperimentBuilder();

  // Load providers on mount
  useEffect(() => {
    if (llmProviders.length === 0) {
      loadProviders();
    }
  }, []);

  // ==================== Manual Mode State ====================

  const [newAgentType, setNewAgentType] = useState<ManualAgentType>({
    id: '',
    label: '',
    count: 1,
    rolePrompt: '',
    userProfile: '',
    properties: { tier: '' },
    providerId: null,
  });

  // ==================== Demographic Mode State ====================

  const [demographics, setDemographics] = useState<Demographic[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [traits, setTraits] = useState<TraitConfig[]>([
    { id: generateId(), name: 'Trust', mean: 50, std: 15 }
  ]);
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, Array<{ id: string; originalKey: string; key: string; value: string }>>>({});
  const [genCount, setGenCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAgents, setGeneratedAgents] = useState<Agent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [tierOrderDraft, setTierOrderDraft] = useState<string[]>(['top', 'mid', 'low']);

  const scenarioId = selectedScenarioData?.id || selectedScenarioId || '';
  const scenarioName = (selectedScenarioData?.name || '').toLowerCase();
  const showTierControls = isPolicyCascadeScenario(scenarioId, scenarioName);
  const tierOrder = useMemo(() => parseTierOrder(scenarioParams?.tier_order), [scenarioParams]);
  const cascadeMode = String(scenarioParams?.cascade_mode || 'strict_cascade');
  const tierOrderDraftValid =
    tierOrderDraft.length >= 2 &&
    tierOrderDraft.every((tier) => tier.trim()) &&
    new Set(tierOrderDraft.map((tier) => tier.trim().toLowerCase())).size === tierOrderDraft.length;
  const hasPendingTierDraft =
    tierOrderDraft.length !== tierOrder.length ||
    tierOrderDraft.some((tier, index) => tier.trim().toLowerCase() !== String(tierOrder[index] || '').trim().toLowerCase());

  useEffect(() => {
    if (!showTierControls) return;
    if (scenarioParams?.tier_order) return;
    setScenarioParams({ ...scenarioParams, tier_order: ['top', 'mid', 'low'] });
  }, [showTierControls, scenarioParams, setScenarioParams]);

  useEffect(() => {
    if (!showTierControls) return;
    setTierOrderDraft(tierOrder);
  }, [showTierControls, tierOrder]);

  // Initialize demographics on first render
  useEffect(() => {
    if (showTierControls) {
      const alreadyTier = demographics.length === 1 && demographics[0]?.name === '政治职位层级';
      const sameCategories = alreadyTier && demographics[0]?.categories.join('|') === tierOrder.join('|');
      if (!sameCategories) {
        setDemographics([{ id: generateId(), name: '政治职位层级', categories: tierOrder }]);
      }
      if (genCount < tierOrder.length) {
        setGenCount(tierOrder.length);
      }
      return;
    }

    const hasPolicyOnlyDemographics = demographics.length === 1 && demographics[0]?.name === '政治职位层级';
    if (demographics.length === 0 || hasPolicyOnlyDemographics) {
      setDemographics([
        {
          id: generateId(),
          name: 'Age',
          categories: ['18-30', '31-50', '51+'],
        },
        {
          id: generateId(),
          name: 'Location',
          categories: ['Urban', 'Suburban', 'Rural'],
        },
      ]);
    }
  }, [showTierControls, demographics, genCount, tierOrder]);

  useEffect(() => {
    if (showTierControls) return;

    if (Object.prototype.hasOwnProperty.call(newAgentType.properties || {}, 'tier')) {
      const nextProperties = { ...(newAgentType.properties || {}) };
      delete nextProperties.tier;
      setNewAgentType((current) => ({
        ...current,
        properties: nextProperties,
      }));
    }

    agentTypes.forEach((agent) => {
      if (!Object.prototype.hasOwnProperty.call(agent.properties || {}, 'tier')) {
        return;
      }
      const nextProperties = { ...(agent.properties || {}) };
      delete nextProperties.tier;
      updateAgentType(agent.id, { properties: nextProperties });
    });
  }, [showTierControls]);

  // Update archetypes when demographics change
  useEffect(() => {
    if (demographics.length > 0 && demographics.every(d => d.categories.length > 0)) {
      setArchetypes(generateArchetypes(demographics));
    } else {
      setArchetypes([]);
    }
  }, [demographics]);

  useEffect(() => {
    setPropertyDrafts((current) => {
      const next: Record<string, Array<{ id: string; originalKey: string; key: string; value: string }>> = {};
      agentTypes.forEach((agent) => {
        const existing = current[agent.id] || [];
        const existingByOriginalKey = new Map(existing.map((item) => [item.originalKey, item]));
        next[agent.id] = Object.entries(agent.properties || {})
          .filter(([key]) => key !== 'avatarUrl')
          .map(([key, value]) => {
            const match = existingByOriginalKey.get(key);
            return {
              id: match?.id || generateId(),
              originalKey: key,
              key: match?.key ?? key,
              value: match?.value ?? String(value ?? ''),
            };
          });
      });
      return next;
    });
  }, [agentTypes]);

  // ==================== Agent Mode Options ====================

  const agentModes = [
    {
      id: 'manual',
      title: t('experimentBuilder.step4.modes.manual.title'),
      description: t('experimentBuilder.step4.modes.manual.description'),
      icon: '✏️',
    },
    {
      id: 'demographic',
      title: t('experimentBuilder.step4.modes.demographic.title'),
      description: t('experimentBuilder.step4.modes.demographic.description'),
      icon: '👥',
    },
    {
      id: 'import',
      title: t('experimentBuilder.step4.modes.import.title'),
      description: t('experimentBuilder.step4.modes.import.description'),
      icon: '📁',
    },
  ];

  // ==================== Manual Mode Handlers ====================

  const handleAddAgentType = () => {
    if (!newAgentType.label.trim()) return;
    const inferredTier = inferOrderedTier(newAgentType, tierOrder);
    const count = Math.max(1, newAgentType.count || 1);
    for (let i = 0; i < count; i++) {
      const nextProperties = { ...(newAgentType.properties || {}) };
      if (showTierControls) {
        nextProperties.tier = inferredTier || String(newAgentType.properties?.tier || '');
      } else {
        delete nextProperties.tier;
      }
      const suffix = count > 1 ? ` ${i + 1}` : '';
      addAgentType({
        ...newAgentType,
        id: `${newAgentType.id || `agent-${Date.now()}`}-${i}`,
        label: `${newAgentType.label}${suffix}`,
        count: 1,
        providerId: selectedProviderId,
        properties: nextProperties,
      });
    }
    setNewAgentType({
      id: '',
      label: '',
      count: 1,
      rolePrompt: '',
      userProfile: '',
      properties: showTierControls ? { tier: '' } : {},
      providerId: selectedProviderId,
    });
  };

  const handleUpdateTier = (id: string, tier: TierValue) => {
    const current = agentTypes.find((agent) => agent.id === id);
    updateAgentType(id, {
      properties: {
        ...(current?.properties || {}),
        tier,
      },
    });
  };

  const handleTierCountChange = (value: string) => {
    const nextCount = Math.max(2, parseInt(value, 10) || 2);
    setTierOrderDraft((current) => resizeTierOrder(current, nextCount));
  };

  const handleTierNameChange = (index: number, value: string) => {
    setTierOrderDraft((current) => current.map((tier, idx) => (idx === index ? value : tier)));
  };

  const handleApplyTierOrder = () => {
    const nextTierOrder = tierOrderDraft.map((tier) => tier.trim());
    setScenarioParams({
      ...scenarioParams,
      tier_order: nextTierOrder,
    });

    if (showTierControls) {
      const selectedTier = String(newAgentType.properties?.tier || '').trim();
      if (selectedTier && !nextTierOrder.some((tier) => tier.toLowerCase() === selectedTier.toLowerCase())) {
        const nextProperties = { ...(newAgentType.properties || {}) };
        delete nextProperties.tier;
        setNewAgentType((current) => ({ ...current, properties: nextProperties }));
      }

      agentTypes.forEach((agent) => {
        const currentTier = String(agent.properties?.tier || '').trim();
        if (!currentTier) return;
        if (nextTierOrder.some((tier) => tier.toLowerCase() === currentTier.toLowerCase())) return;
        const nextProperties = { ...(agent.properties || {}) };
        delete nextProperties.tier;
        updateAgentType(agent.id, { properties: nextProperties });
      });
    }
  };

  const handleAddProperty = (id: string) => {
    const current = agentTypes.find((agent) => agent.id === id);
    const properties = { ...(current?.properties || {}) };
    let nextKey = 'new_property';
    let idx = 1;
    while (properties[nextKey] !== undefined) {
      idx += 1;
      nextKey = `new_property_${idx}`;
    }
    properties[nextKey] = '';
    updateAgentType(id, { properties });
  };

  const handleDraftPropertyChange = (agentId: string, rowId: string, field: 'key' | 'value', value: string) => {
    setPropertyDrafts((current) => ({
      ...current,
      [agentId]: (current[agentId] || []).map((item) =>
        item.id === rowId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleCommitPropertyKey = (agentId: string, rowId: string) => {
    const row = (propertyDrafts[agentId] || []).find((item) => item.id === rowId);
    if (!row) return;

    const oldKey = row.originalKey;
    const newKey = row.key.trim();
    if (!newKey) {
      setPropertyDrafts((current) => ({
        ...current,
        [agentId]: (current[agentId] || []).map((item) =>
          item.id === rowId ? { ...item, key: item.originalKey } : item
        ),
      }));
      return;
    }
    if (newKey === oldKey) return;

    const linkedAgents = agentTypes.filter((agent) => Object.prototype.hasOwnProperty.call(agent.properties || {}, oldKey));
    if (linkedAgents.length > 1) {
      const confirmed = window.confirm(
        t('experimentBuilder.step4.sharedPropertyConfirm', {
          defaultValue: 'This property is shared by multiple agents. Rename it for all linked agents?',
          key: oldKey,
          count: linkedAgents.length,
        })
      );
      if (!confirmed) {
        setPropertyDrafts((current) => ({
          ...current,
          [agentId]: (current[agentId] || []).map((item) =>
            item.id === rowId ? { ...item, key: item.originalKey } : item
          ),
        }));
        return;
      }
    }

    linkedAgents.forEach((agent) => {
      const properties = { ...(agent.properties || {}) };
      const value = properties[oldKey];
      delete properties[oldKey];
      properties[newKey] = value;
      updateAgentType(agent.id, { properties });
    });
  };

  const handleCommitPropertyValue = (agentId: string, rowId: string) => {
    const row = (propertyDrafts[agentId] || []).find((item) => item.id === rowId);
    if (!row) return;
    const effectiveKey = row.key.trim() || row.originalKey;
    const current = agentTypes.find((agent) => agent.id === agentId);
    const properties = { ...(current?.properties || {}) };
    if (effectiveKey !== row.originalKey) {
      delete properties[row.originalKey];
    }
    properties[effectiveKey] = row.value;
    updateAgentType(agentId, { properties });
  };

  const handleRemoveProperty = (id: string, key: string) => {
    const current = agentTypes.find((agent) => agent.id === id);
    const properties = { ...(current?.properties || {}) };
    delete properties[key];
    updateAgentType(id, { properties });
  };

  // ==================== Demographic Mode Handlers ====================

  const handleAddDemographic = () => {
    setDemographics([...demographics, { id: generateId(), name: 'New Dimension', categories: [] }]);
  };

  const handleRemoveDemographic = (id: string) => {
    if (demographics.length > 1) {
      setDemographics(demographics.filter((d) => d.id !== id));
    }
  };

  const handleUpdateDemographicName = (id: string, name: string) => {
    setDemographics(demographics.map((d) => (d.id === id ? { ...d, name } : d)));
  };

  const handleUpdateDemographicCategories = (id: string, categories: string) => {
    const cats = categories.split('\n').map((c) => c.trim()).filter((c) => c);
    setDemographics(demographics.map((d) => (d.id === id ? { ...d, categories: cats } : d)));
  };

  const handleUpdateCategoryName = (demoId: string, catIndex: number, value: string) => {
    setDemographics(
      demographics.map((d) => {
        if (d.id === demoId) {
          const newCats = [...d.categories];
          newCats[catIndex] = value;
          return { ...d, categories: newCats };
        }
        return d;
      })
    );
  };

  const handleAddCategory = (demoId: string) => {
    setDemographics(
      demographics.map((d) => {
        if (d.id === demoId) {
          return { ...d, categories: [...d.categories, 'New Category'] };
        }
        return d;
      })
    );
  };

  const handleRemoveCategory = (demoId: string, catIndex: number) => {
    setDemographics(
      demographics.map((d) => {
        if (d.id === demoId && d.categories.length > 1) {
          return { ...d, categories: d.categories.filter((_, i) => i !== catIndex) };
        }
        return d;
      })
    );
  };

  const handleUpdateArchetypeProbability = (archId: string, newProb: number) => {
    const oldProb = archetypes.find((a) => a.id === archId)?.probability || 0;
    const currentTotal = archetypes.reduce((sum, a) => sum + a.probability, 0);
    const remainingTotal = currentTotal - oldProb;

    setArchetypes(
      archetypes.map((a) => {
        if (a.id === archId) {
          return { ...a, probability: Math.max(0, Math.min(1, newProb)) };
        } else if (remainingTotal > 0) {
          const scale = (1 - newProb) / remainingTotal;
          return { ...a, probability: Math.max(0, a.probability * scale) };
        }
        return a;
      })
    );
  };

  const handleNormalizeProbabilities = () => {
    const total = archetypes.reduce((sum, a) => sum + a.probability, 0) || 1;
    setArchetypes(archetypes.map((a) => ({ ...a, probability: a.probability / total })));
  };

  const handleAddTrait = () => {
    setTraits([...traits, { id: generateId(), name: `Trait ${traits.length + 1}`, mean: 50, std: 15 }]);
  };

  const handleRemoveTrait = (id: string) => {
    if (traits.length > 1) {
      setTraits(traits.filter((t) => t.id !== id));
    }
  };

  const handleUpdateTrait = (id: string, field: keyof TraitConfig, value: string | number) => {
    setTraits(traits.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleGenerateAgents = async () => {
    if (demographics.length === 0 || demographics.some((d) => d.categories.length === 0)) {
      setImportError('Please add at least one demographic dimension with categories.');
      return;
    }

    setIsGenerating(true);
    setImportError(null);

    try {
      const currentLang = isZh() ? 'zh' : 'en';

      // Build demographics array
      const demographicsData = demographics.map((d) => ({
        name: d.name,
        categories: d.categories,
      }));

      // Build archetype probabilities
      const archetypeProbabilities: Record<string, number> = {};
      archetypes.forEach((a) => {
        archetypeProbabilities[a.id] = a.probability;
      });

      // Build traits data
      const traitsData = traits.map((t) => ({
        name: t.name,
        mean: t.mean,
        std: t.std,
      }));

      // Call the real backend API
      const agents = await generateAgentsWithDemographics(
        genCount,
        demographicsData,
        archetypeProbabilities,
        traitsData,
        currentLang,
        selectedProviderId ?? undefined
      );

      setGeneratedAgents(agents);

      // Convert generated agents to ManualAgentType format and add to store
      agents.forEach((agent) => {
        const inferredTier = inferOrderedTier({
          properties: {
            tier: agent.properties?.tier,
            政治职位层级: agent.properties?.['政治职位层级'],
          },
          rolePrompt: agent.profile,
          userProfile: agent.profile,
          label: agent.name,
        }, tierOrder);
        const nextProperties: Record<string, unknown> = {
          avatarUrl: agent.avatarUrl,
          ...agent.properties,
          archetype_id: agent.properties?.archetype_id || '',
          demographic_attributes: JSON.stringify(agent.properties || {}),
        };
        if (showTierControls) {
          nextProperties.tier = inferredTier || String(agent.properties?.tier || agent.properties?.['政治职位层级'] || '');
        } else {
          delete nextProperties.tier;
        }
        const agentType: ManualAgentType = {
          id: `demo-agent-${agent.id}`,
          label: agent.name,
          count: 1,
          rolePrompt: agent.profile,
          userProfile: agent.profile,
          properties: nextProperties,
          providerId: selectedProviderId ?? undefined,
        };
        addAgentType(agentType);
      });
    } catch (error) {
      console.error('Agent generation error:', error);
      setImportError(`Failed to generate agents: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ==================== Computed Values ====================

  const totalAgents = agentTypes.reduce((sum, t) => sum + t.count, 0);
  const tierPreviewStats = useMemo(() => {
    const counts: Record<string, number> = {};
    tierOrder.forEach((tier) => {
      counts[tier] = 0;
    });

    let unassigned = 0;
    agentTypes.forEach((agent) => {
      const amount = Math.max(1, agent.count || 1);
      const matchedTier = inferOrderedTier(agent, tierOrder);
      if (matchedTier) {
        counts[matchedTier] = (counts[matchedTier] || 0) + amount;
        return;
      }
      unassigned += amount;
    });

    return { counts, unassigned };
  }, [agentTypes, tierOrder]);
  const sharedPropertyOwners = useMemo(() => {
    const owners: Record<string, string[]> = {};
    agentTypes.forEach((agent) => {
      Object.keys(agent.properties || {})
        .filter((key) => key !== 'avatarUrl')
        .forEach((key) => {
          if (!owners[key]) {
            owners[key] = [];
          }
          owners[key].push(agent.label);
        });
    });
    return owners;
  }, [agentTypes]);

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      <section className="studio-field-group">
        <div className="page-hero__eyebrow w-fit">Agent casting</div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step4.modeTitle')}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--sim-text-muted)]">
              Shape who enters the experiment, how many voices appear, and how diverse their roles should be before the network starts evolving.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill">{t('experimentBuilder.step4.totalAgents', { count: totalAgents })}</span>
            <span className="status-pill">{agentModes.find((mode) => mode.id === agentMode)?.title}</span>
            {selectedProviderId && <span className="status-pill">LLM linked</span>}
          </div>
        </div>

        <div className="studio-mode-grid">
          {agentModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setAgentMode(mode.id as 'manual' | 'demographic' | 'import')}
              className={`studio-mode-card ${agentMode === mode.id ? 'active' : ''}`.trim()}
            >
              <span className="studio-mode-card__icon">{mode.icon}</span>
              <div>
                <div className="text-sm font-semibold text-[var(--sim-text-strong)]">{mode.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">{mode.description}</p>
              </div>
              <div className="mt-auto text-xs font-medium uppercase tracking-[0.16em] text-[var(--sim-text-soft)]">
                {agentMode === mode.id ? 'Selected mode' : 'Choose mode'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {showTierControls && (
        <div className="studio-tier-grid">
          <section className="studio-tier-card">
            <div className="page-hero__eyebrow w-fit">Cascade tiers</div>
            <div>
              <h3 className="text-base font-semibold text-[var(--sim-text-strong)]">
                {t('experimentBuilder.step4.tierConfigTitle')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
                {t('experimentBuilder.step4.tierConfigDesc')}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sim-text-soft)]">
                {t('experimentBuilder.step4.tierCountLabel')}
                <input
                  type="number"
                  min="2"
                  value={tierOrderDraft.length}
                  onChange={(e) => handleTierCountChange(e.target.value)}
                  className="input"
                />
              </label>
              <div className="rounded-[20px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.38)] px-4 py-3 text-sm leading-6 text-[var(--sim-text-muted)] dark:bg-[rgba(255,255,255,0.02)]">
                {t('experimentBuilder.step4.tierConfigHint')}
              </div>
            </div>

            <div className="space-y-3">
              {tierOrderDraft.map((tierName, index) => (
                <div key={index} className="grid items-center gap-3 md:grid-cols-[108px_minmax(0,1fr)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sim-text-soft)]">
                    {t('experimentBuilder.step4.tierLevelLabel', { index: index + 1 })}
                  </div>
                  <input
                    type="text"
                    value={tierName}
                    onChange={(e) => handleTierNameChange(index, e.target.value)}
                    className="input"
                    placeholder={t('experimentBuilder.step4.tierNamePlaceholder', { name: defaultTierName(index) })}
                  />
                </div>
              ))}
            </div>

            {!tierOrderDraftValid && (
              <div className="rounded-[18px] border border-[rgba(196,107,114,0.18)] bg-[rgba(196,107,114,0.08)] px-4 py-3 text-sm text-[var(--sim-danger)]">
                {t('experimentBuilder.step4.tierDraftInvalid')}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={handleApplyTierOrder} disabled={!tierOrderDraftValid}>
                {t('experimentBuilder.step4.applyTierConfig')}
              </Button>
              <span className="text-xs text-[var(--sim-text-soft)]">
                {t(`experimentBuilder.step4.cascadeModeLabels.${cascadeMode}`)}
              </span>
            </div>
          </section>

          <section className="studio-tier-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="page-hero__eyebrow w-fit">Influence structure</div>
                <h3 className="mt-2 text-base font-semibold text-[var(--sim-text-strong)]">
                  {t('experimentBuilder.step4.tierPreviewTitle')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
                  {t('experimentBuilder.step4.tierPreviewDesc', { count: tierOrder.length })}
                </p>
              </div>
              <span className="status-pill">{t(`experimentBuilder.step4.cascadeModeLabels.${cascadeMode}`)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tierOrder.map((tier, index) => (
                <React.Fragment key={tier}>
                  <div className="rounded-[18px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.56)] px-4 py-3 shadow-[var(--sim-shadow-xs)] dark:bg-[rgba(255,255,255,0.02)]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sim-text-soft)]">
                      {t('experimentBuilder.step4.tierLevelLabel', { index: index + 1 })}
                    </div>
                    <div className="mt-2 font-semibold text-[var(--sim-text-strong)]">{tier}</div>
                  </div>
                  {index < tierOrder.length - 1 && <span className="text-[var(--sim-text-soft)]">→</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {tierOrder.map((tier, index) => (
                <div
                  key={`${tier}-count`}
                  className="rounded-[20px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.44)] px-4 py-4 dark:bg-[rgba(255,255,255,0.02)]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sim-text-soft)]">
                    {t('experimentBuilder.step4.tierLevelLabel', { index: index + 1 })}
                  </div>
                  <div className="mt-2 text-base font-semibold text-[var(--sim-text-strong)]">{tier}</div>
                  <div className="mt-2 text-sm text-[var(--sim-text-muted)]">
                    {t('experimentBuilder.step4.tierAssignedCount', { count: tierPreviewStats.counts[tier] || 0 })}
                  </div>
                </div>
              ))}
              <div className="rounded-[20px] border border-dashed border-[var(--sim-border-strong)] bg-[rgba(255,255,255,0.34)] px-4 py-4 dark:bg-[rgba(255,255,255,0.02)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sim-text-soft)]">
                  {t('experimentBuilder.step4.unassignedTitle')}
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--sim-text-strong)]">
                  {t('experimentBuilder.step4.unassignedCount', { count: tierPreviewStats.unassigned })}
                </div>
                <div className="mt-2 text-sm text-[var(--sim-text-muted)]">
                  {t('experimentBuilder.step4.unassignedHint')}
                </div>
              </div>
            </div>

            {hasPendingTierDraft && (
              <div className="rounded-[18px] border border-[rgba(206,152,74,0.22)] bg-[rgba(206,152,74,0.1)] px-4 py-3 text-sm text-[var(--sim-warning)]">
                {t('experimentBuilder.step4.tierDraftPending')}
              </div>
            )}
          </section>
        </div>
      )}

      {agentMode === 'manual' && (
        <section className="studio-field-group">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="page-hero__eyebrow w-fit">Manual casting</div>
              <h3 className="mt-2 text-base font-semibold text-[var(--sim-text-strong)]">
                {t('experimentBuilder.step4.defineTypes')}
              </h3>
            </div>
            <span className="status-pill">{t('experimentBuilder.step4.manualHint')}</span>
          </div>

          <div className="rounded-[22px] border border-[rgba(206,152,74,0.22)] bg-[rgba(206,152,74,0.08)] px-4 py-3 text-sm leading-6 text-[var(--sim-text)]">
            {t('experimentBuilder.step4.manualHint')}
          </div>

          <div className="studio-pane-grid two">
            <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step4.typeLabel')}
              <input
                type="text"
                value={newAgentType.label}
                onChange={(e) => setNewAgentType({ ...newAgentType, label: e.target.value })}
                placeholder={t('experimentBuilder.step4.typeLabelPlaceholder')}
                className="input"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step4.count')}
              <input
                type="number"
                min="1"
                value={newAgentType.count}
                onChange={(e) => setNewAgentType({ ...newAgentType, count: parseInt(e.target.value, 10) || 1 })}
                className="input"
              />
            </label>
            {showTierControls && (
              <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                {t('experimentBuilder.step4.tier')}
                <select
                  value={String(newAgentType.properties?.tier || '')}
                  onChange={(e) =>
                    setNewAgentType({
                      ...newAgentType,
                      properties: { ...newAgentType.properties, tier: e.target.value },
                    })
                  }
                  className="input"
                >
                  <option value="">{t('experimentBuilder.step4.autoDetectTier')}</option>
                  {tierOrder.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step4.userProfile')}
              <input
                type="text"
                value={newAgentType.userProfile}
                onChange={(e) => setNewAgentType({ ...newAgentType, userProfile: e.target.value })}
                placeholder={t('experimentBuilder.step4.userProfilePlaceholder')}
                className="input"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
            {t('experimentBuilder.step4.rolePrompt')}
            <textarea
              value={newAgentType.rolePrompt}
              onChange={(e) => setNewAgentType({ ...newAgentType, rolePrompt: e.target.value })}
              placeholder={t('experimentBuilder.step4.rolePromptPlaceholder')}
              rows={4}
              className="input min-h-[132px]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleAddAgentType} size="sm" disabled={!newAgentType.label.trim()}>
              {t('experimentBuilder.step4.addAgentType')}
            </Button>
            <span className="text-sm text-[var(--sim-text-soft)]">
              Create one cast profile or multiply into several named agents at once.
            </span>
          </div>
        </section>
      )}

      {agentMode === 'demographic' && (
        <section className="studio-field-group">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="page-hero__eyebrow w-fit">Population generator</div>
              <h3 className="mt-2 text-base font-semibold text-[var(--sim-text-strong)]">
                {t('experimentBuilder.step4.modes.demographic.title')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
                Generate a cast from demographics, archetypes, and trait distributions while keeping the existing backend generation flow intact.
              </p>
            </div>
            <span className="status-pill">{generatedAgents.length} generated</span>
          </div>

          {llmProviders.length > 0 && (
            <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)] md:max-w-xl">
              {t('experimentBuilder.step4.llmProvider')}
              <select
                value={selectedProviderId || ''}
                onChange={(e) => setSelectedProviderId(e.target.value || null)}
                className="input"
              >
                <option value="">{t('experimentBuilder.step4.defaultProvider')}</option>
                {llmProviders.map((p: LLMProvider) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.model ? ` (${p.model})` : ''}
                    {p.is_active ? ' • Active' : ''}
                    {p.is_default ? ' • Default' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="rounded-[26px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.4)] p-4 dark:bg-[rgba(255,255,255,0.02)]">
            <Step2DemographicsEditor
              demographics={demographics}
              archetypes={archetypes}
              traits={traits}
              genCount={genCount}
              isGenerating={isGenerating}
              onAddDemographic={handleAddDemographic}
              onRemoveDemographic={handleRemoveDemographic}
              onUpdateDemographicName={handleUpdateDemographicName}
              onUpdateDemographicCategories={handleUpdateDemographicCategories}
              onUpdateCategoryName={handleUpdateCategoryName}
              onAddCategory={handleAddCategory}
              onRemoveCategory={handleRemoveCategory}
              onUpdateArchetypeProbability={handleUpdateArchetypeProbability}
              onNormalizeProbabilities={handleNormalizeProbabilities}
              onAddTrait={handleAddTrait}
              onRemoveTrait={handleRemoveTrait}
              onUpdateTrait={handleUpdateTrait}
              onSetGenCount={setGenCount}
              onGenerateAgents={handleGenerateAgents}
              customAgents={generatedAgents}
              setCustomAgents={setGeneratedAgents}
              importError={importError}
              useTranslation={false}
            />
          </div>
        </section>
      )}

      <section className="studio-field-group">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="page-hero__eyebrow w-fit">Configured agents</div>
            <h3 className="mt-2 text-base font-semibold text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step4.agentListTitle')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
              Review identities, prompts, provider selection, and custom properties before the network topology is assigned.
            </p>
          </div>
          {totalAgents > 0 && (
            <span className="status-pill">{t('experimentBuilder.step4.totalAgents', { count: totalAgents })}</span>
          )}
        </div>

        {agentTypes.length === 0 ? (
          <div className="studio-empty-state">
            <div className="text-sm font-semibold text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step4.noTypes')}
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--sim-text-muted)]">
              Start from manual casting, generate a population, or import an archive. Every configured voice will appear here as an editable profile card.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {agentTypes.map((type) => {
              const avatarUrl =
                (type.properties?.avatarUrl as string) ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(type.label)}`;
              const tier = inferOrderedTier(type, tierOrder);
              const editableProperties = propertyDrafts[type.id] || [];

              return (
                <article key={type.id} className="studio-agent-card">
                  <div className="studio-agent-card__header">
                    <div className="flex min-w-0 items-start gap-4">
                      <img src={avatarUrl} alt={type.label} className="studio-agent-card__avatar" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-[var(--sim-text-strong)]">{type.label}</h4>
                          {tier && <span className="status-pill">{tier}</span>}
                          {type.providerId && <span className="status-pill">LLM assigned</span>}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
                          {type.userProfile || type.rolePrompt || 'No profile summary yet.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAgentType(type.id)}
                      className="!border-[rgba(196,107,114,0.18)] !bg-[rgba(196,107,114,0.08)] !text-[var(--sim-danger)]"
                    >
                      {t('experimentBuilder.step4.remove')}
                    </Button>
                  </div>

                  <div className="studio-pane-grid two">
                    <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                      {t('experimentBuilder.step4.agentName')}
                      <input
                        type="text"
                        value={type.label}
                        onChange={(e) => updateAgentType(type.id, { label: e.target.value })}
                        className="input"
                      />
                    </label>
                    {showTierControls && (
                      <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                        {t('experimentBuilder.step4.tier')}
                        <select
                          value={tier}
                          onChange={(e) => handleUpdateTier(type.id, e.target.value as TierValue)}
                          className="input"
                        >
                          <option value="">{t('experimentBuilder.step4.autoDetectTier')}</option>
                          {tierOrder.map((tierOption) => (
                            <option key={tierOption} value={tierOption}>
                              {tierOption}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)] md:col-span-2">
                      {t('experimentBuilder.step4.userProfile')}
                      <input
                        type="text"
                        value={type.userProfile || ''}
                        onChange={(e) => updateAgentType(type.id, { userProfile: e.target.value })}
                        className="input"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)] md:col-span-2">
                      {t('experimentBuilder.step4.rolePrompt')}
                      <textarea
                        value={type.rolePrompt || ''}
                        onChange={(e) => updateAgentType(type.id, { rolePrompt: e.target.value })}
                        rows={4}
                        className="input min-h-[132px]"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[var(--sim-text-strong)]">
                      {t('experimentBuilder.step4.llmProvider')}
                      <select
                        value={type.providerId ?? ''}
                        onChange={(e) =>
                          updateAgentType(type.id, { providerId: e.target.value ? Number(e.target.value) : null })
                        }
                        className="input"
                      >
                        <option value="">{t('experimentBuilder.step4.defaultProvider')}</option>
                        {llmProviders.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.model ? ` (${p.model})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-[22px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.36)] p-4 dark:bg-[rgba(255,255,255,0.02)]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--sim-text-strong)]">
                          {t('experimentBuilder.step4.properties')}
                        </div>
                        <div className="mt-1 text-sm text-[var(--sim-text-muted)]">
                          Store reusable metadata such as stance, constituency, or internal state.
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleAddProperty(type.id)}>
                        {t('experimentBuilder.step4.addProperty')}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {editableProperties.length === 0 && (
                        <div className="rounded-[18px] border border-dashed border-[var(--sim-border)] px-4 py-4 text-sm text-[var(--sim-text-soft)]">
                          {t('experimentBuilder.step4.noProperties')}
                        </div>
                      )}
                      {editableProperties.map((item) => (
                        <div key={item.id} className="studio-property-row">
                          <div className="relative">
                            <input
                              type="text"
                              value={item.key}
                              onChange={(e) => handleDraftPropertyChange(type.id, item.id, 'key', e.target.value)}
                              onBlur={() => handleCommitPropertyKey(type.id, item.id)}
                              className="input pr-16"
                            />
                            {(sharedPropertyOwners[item.originalKey] || []).length > 1 && (
                              <span
                                title={t('experimentBuilder.step4.sharedPropertyTooltip', {
                                  key: item.originalKey,
                                  agents: sharedPropertyOwners[item.originalKey].join('、'),
                                })}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[rgba(206,152,74,0.14)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sim-warning)]"
                              >
                                {t('experimentBuilder.step4.sharedPropertyBadge')}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) => handleDraftPropertyChange(type.id, item.id, 'value', e.target.value)}
                            onBlur={() => handleCommitPropertyValue(type.id, item.id)}
                            className="input"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProperty(type.id, item.originalKey)}
                            className="!border-[rgba(196,107,114,0.18)] !bg-[rgba(196,107,114,0.08)] !text-[var(--sim-danger)]"
                          >
                            {t('experimentBuilder.step4.remove')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {agentMode === 'import' && (
        <section className="studio-field-group">
          <div className="page-hero__eyebrow w-fit">Archive import</div>
          <div className="max-w-3xl">
            <h3 className="text-base font-semibold text-[var(--sim-text-strong)]">
              {t('experimentBuilder.step4.importTitle')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--sim-text-muted)]">
              {t('experimentBuilder.step4.importDesc')}
            </p>
          </div>

          <div className="studio-pane-grid two">
            <div className="rounded-[22px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.4)] p-4 dark:bg-[rgba(255,255,255,0.02)]">
              <label className="mb-3 block text-sm font-medium text-[var(--sim-text-strong)]">
                {t('experimentBuilder.step4.csvFormat')}
              </label>
              <pre className="overflow-x-auto rounded-[18px] border border-[var(--sim-border)] bg-[rgba(16,24,37,0.9)] p-4 text-xs text-slate-100">
                <code>name,role_prompt,user_profile,opinion</code>
              </pre>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-[22px] border border-[var(--sim-border)] bg-[rgba(255,255,255,0.4)] p-4 dark:bg-[rgba(255,255,255,0.02)]">
              <div className="text-sm leading-6 text-[var(--sim-text-muted)]">
                {t('experimentBuilder.step4.importInfo')}
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="button-ghost cursor-pointer">
                  <input type="file" accept=".csv,.json" className="hidden" />
                  {t('experimentBuilder.step4.uploadCSV')}
                </label>
                <label className="button-ghost cursor-pointer">
                  <input type="file" accept=".csv,.json" className="hidden" />
                  {t('experimentBuilder.step4.uploadJSON')}
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {totalAgents > 0 && (
        <div className="rounded-[22px] border border-[rgba(47,141,99,0.18)] bg-[rgba(47,141,99,0.1)] px-5 py-4 text-sm text-[var(--sim-success)]">
          {t('experimentBuilder.step4.agentsDefined', { count: totalAgents })}
        </div>
      )}
    </div>
  );
};

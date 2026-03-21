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
import { Search } from 'lucide-react';
import { useExperimentBuilder, ManualAgentType, LLMProvider } from '../../store/experiment-builder';
import { generateAgentsWithDemographics, isZh } from '../../store/helpers';
import { Step2DemographicsEditor, Demographic, Archetype, TraitConfig } from '../wizard/Step2DemographicsEditor';
import type { Agent } from '../../types';
import { Button } from '../ui/button';
import { buildAgentCollections } from '../../utils/agentCollections';
import { FieldBlock } from './workflow/FieldBlock';
import { ParticipantCard } from './workflow/ParticipantCard';
import { ResearchInputPanel } from './workflow/ResearchInputPanel';
import { SummaryInfoCard } from './workflow/SummaryInfoCard';

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
  const [agentDirectoryQuery, setAgentDirectoryQuery] = useState('');
  const [selectedEditorAgentId, setSelectedEditorAgentId] = useState<string | null>(null);

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
  const sharedPropertyCount = useMemo(
    () => Object.values(sharedPropertyOwners).filter((owners) => owners.length > 1).length,
    [sharedPropertyOwners]
  );
  const providerCount = useMemo(
    () => new Set(agentTypes.map((agent) => agent.providerId).filter(Boolean)).size,
    [agentTypes]
  );
  const agentCollections = useMemo(
    () => buildAgentCollections(agentTypes, (agent) => inferOrderedTier(agent, tierOrder)),
    [agentTypes, tierOrder]
  );
  const filteredAgentCollections = useMemo(() => {
    const query = agentDirectoryQuery.trim().toLowerCase();
    if (!query) {
      return agentCollections;
    }

    return agentCollections.filter((collection) => {
      const providerLabel =
        llmProviders.find((provider) => provider.id === collection.providerId)?.name ||
        t('experimentBuilder.step4.defaultProvider');
      const haystack = [
        collection.title,
        collection.representative.rolePrompt || '',
        collection.representative.userProfile || '',
        collection.tier,
        providerLabel,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [agentCollections, agentDirectoryQuery, llmProviders, t]);
  const selectedEditorAgent = useMemo(
    () => {
      if (agentDirectoryQuery.trim() && filteredAgentCollections.length === 0) {
        return null;
      }
      return (
        agentTypes.find((agent) => agent.id === selectedEditorAgentId) ||
        filteredAgentCollections[0]?.representative ||
        agentCollections[0]?.representative ||
        null
      );
    },
    [agentCollections, agentDirectoryQuery, agentTypes, filteredAgentCollections, selectedEditorAgentId]
  );
  const selectedCollection = useMemo(
    () =>
      agentCollections.find((collection) =>
        collection.members.some((member) => member.id === selectedEditorAgent?.id)
      ) || null,
    [agentCollections, selectedEditorAgent]
  );
  const selectedEditorAvatarUrl = selectedEditorAgent
    ? ((selectedEditorAgent.properties?.avatarUrl as string) ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(selectedEditorAgent.label)}`)
    : '';
  const selectedEditorTier = selectedEditorAgent ? inferOrderedTier(selectedEditorAgent, tierOrder) : '';
  const selectedEditableProperties = selectedEditorAgent ? propertyDrafts[selectedEditorAgent.id] || [] : [];

  useEffect(() => {
    if (!selectedEditorAgent) {
      setSelectedEditorAgentId(null);
      return;
    }
    if (selectedEditorAgent.id !== selectedEditorAgentId) {
      setSelectedEditorAgentId(selectedEditorAgent.id);
    }
  }, [selectedEditorAgent, selectedEditorAgentId]);

  // ==================== Render ====================

  return (
    <div className="ss-participant-workflow">
      <ResearchInputPanel
        eyebrow={t('experimentBuilder.step4.title', { defaultValue: 'Social Dynamics' })}
        title={t('experimentBuilder.step4.modeTitle')}
        description={t('experimentBuilder.step4.modeDescription', {
          defaultValue:
            '先确定参与者的组织方式，再逐步补充代表成员与研究属性。',
        })}
      >
        <div className="ss-participant-workflow__mode-grid">
          {agentModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setAgentMode(mode.id as 'manual' | 'demographic' | 'import')}
              className={`ss-participant-workflow__mode-card${agentMode === mode.id ? ' is-active' : ''}`}
            >
              <span className="ss-participant-workflow__mode-icon">{mode.icon}</span>
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
            </button>
          ))}
        </div>
      </ResearchInputPanel>

      {showTierControls && (
        <div className="space-y-4">
          <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
            <h4 className="font-semibold text-gray-900 mb-2">{t('experimentBuilder.step4.tierConfigTitle')}</h4>
            <p className="text-sm text-gray-700 mb-3">
              {t('experimentBuilder.step4.tierConfigDesc')}
            </p>
            <div className="mb-3 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('experimentBuilder.step4.tierCountLabel')}</label>
                <input
                  type="number"
                  min="2"
                  value={tierOrderDraft.length}
                  onChange={(e) => handleTierCountChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                />
              </div>
              <div className="text-xs text-gray-600">
                {t('experimentBuilder.step4.tierConfigHint')}
              </div>
            </div>
            <div className="space-y-2">
              {tierOrderDraft.map((tierName, index) => (
                <div key={index} className="grid grid-cols-[96px_1fr] gap-3 items-center">
                  <div className="text-sm font-medium text-gray-700">
                    {t('experimentBuilder.step4.tierLevelLabel', { index: index + 1 })}
                  </div>
                  <input
                    type="text"
                    value={tierName}
                    onChange={(e) => handleTierNameChange(index, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                    placeholder={t('experimentBuilder.step4.tierNamePlaceholder', { name: defaultTierName(index) })}
                  />
                </div>
              ))}
            </div>
            {!tierOrderDraftValid && (
              <div className="mt-3 text-xs text-red-600">{t('experimentBuilder.step4.tierDraftInvalid')}</div>
            )}
            <div className="mt-3">
              <Button size="sm" onClick={handleApplyTierOrder} disabled={!tierOrderDraftValid}>
                {t('experimentBuilder.step4.applyTierConfig')}
              </Button>
            </div>
          </div>

          <div className="p-4 border border-indigo-200 rounded-lg bg-indigo-50">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">{t('experimentBuilder.step4.tierPreviewTitle')}</h4>
                <p className="text-sm text-gray-700 mt-1">
                  {t('experimentBuilder.step4.tierPreviewDesc', { count: tierOrder.length })}
                </p>
              </div>
              <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700">
                {t(`experimentBuilder.step4.cascadeModeLabels.${cascadeMode}`)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {tierOrder.map((tier, index) => (
                <React.Fragment key={tier}>
                  <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">
                    <div className="text-[11px] font-medium text-indigo-600 uppercase tracking-wide">
                      {t('experimentBuilder.step4.tierLevelLabel', { index: index + 1 })}
                    </div>
                    <div className="font-medium">{tier}</div>
                  </div>
                  {index < tierOrder.length - 1 && (
                    <span className="text-indigo-400 text-lg leading-none">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {tierOrder.map((tier, index) => (
                <div key={`${tier}-count`} className="rounded-lg border border-indigo-100 bg-white px-3 py-3">
                  <div className="text-xs font-medium text-indigo-600 mb-1">
                    {t('experimentBuilder.step4.tierLevelLabel', { index: index + 1 })}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{tier}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {t('experimentBuilder.step4.tierAssignedCount', { count: tierPreviewStats.counts[tier] || 0 })}
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-dashed border-indigo-200 bg-white/80 px-3 py-3">
                <div className="text-xs font-medium text-indigo-600 mb-1">
                  {t('experimentBuilder.step4.unassignedTitle')}
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {t('experimentBuilder.step4.unassignedCount', { count: tierPreviewStats.unassigned })}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {t('experimentBuilder.step4.unassignedHint')}
                </div>
              </div>
            </div>

            {hasPendingTierDraft && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t('experimentBuilder.step4.tierDraftPending')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Agent Types */}
      {agentMode === 'manual' && (
        <ResearchInputPanel
          eyebrow={t('experimentBuilder.step4.defineTypes', { defaultValue: 'Participant form' })}
          title={t('experimentBuilder.step4.defineTypes')}
          description={t('experimentBuilder.step4.manualHint')}
        >
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t('experimentBuilder.step4.manualHint')}
          </div>

          {/* Add New Agent Type */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('experimentBuilder.step4.typeLabel')}</label>
                <input
                  type="text"
                  value={newAgentType.label}
                  onChange={(e) => setNewAgentType({ ...newAgentType, label: e.target.value })}
                  placeholder={t('experimentBuilder.step4.typeLabelPlaceholder')}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('experimentBuilder.step4.count')}</label>
                <input
                  type="number"
                  min="1"
                  value={newAgentType.count}
                  onChange={(e) =>
                    setNewAgentType({ ...newAgentType, count: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {showTierControls && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('experimentBuilder.step4.tier')}</label>
                  <select
                    value={String(newAgentType.properties?.tier || '')}
                    onChange={(e) => setNewAgentType({
                      ...newAgentType,
                      properties: { ...newAgentType.properties, tier: e.target.value },
                    })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                  >
                    <option value="">{t('experimentBuilder.step4.autoDetectTier')}</option>
                      {tierOrder.map((tier) => (
                        <option key={tier} value={tier}>{tier}</option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('experimentBuilder.step4.userProfile')}</label>
                <input
                  type="text"
                  value={newAgentType.userProfile}
                  onChange={(e) => setNewAgentType({ ...newAgentType, userProfile: e.target.value })}
                  placeholder={t('experimentBuilder.step4.userProfilePlaceholder')}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('experimentBuilder.step4.rolePrompt')}
              </label>
              <textarea
                value={newAgentType.rolePrompt}
                onChange={(e) => setNewAgentType({ ...newAgentType, rolePrompt: e.target.value })}
                placeholder={t('experimentBuilder.step4.rolePromptPlaceholder')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                rows={2}
              />
            </div>
            <Button onClick={handleAddAgentType} size="sm" disabled={!newAgentType.label.trim()}>
              {t('experimentBuilder.step4.addAgentType')}
            </Button>
          </div>
        </ResearchInputPanel>
      )}

      {/* Demographic Generation */}
      {agentMode === 'demographic' && (
        <ResearchInputPanel
          eyebrow={t('experimentBuilder.step4.demographicTitle', { defaultValue: 'Group generation' })}
          title={t('experimentBuilder.step4.demographicTitle', { defaultValue: 'Demographic generation' })}
          description={t('experimentBuilder.step4.demographicDescription', {
            defaultValue: '先定义人口结构，再据此生成代表性的参与者集合。',
          })}
        >
          {/* LLM Provider Selector */}
          {llmProviders.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('experimentBuilder.step4.llmProvider')}</label>
              <select
                value={selectedProviderId || ''}
                onChange={(e) => setSelectedProviderId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">{t('experimentBuilder.step4.defaultProvider')}</option>
                {llmProviders.map((p: LLMProvider) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.model ? ` (${p.model})` : ''}
                    {p.is_active && <span className="text-green-600 ml-1">● Active</span>}
                    {p.is_default && <span className="text-blue-500 ml-1">● Default</span>}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Use the flexible demographic editor */}
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
        </ResearchInputPanel>
      )}

      {/* Editable Agent List */}
      <ResearchInputPanel
        eyebrow={t('experimentBuilder.step4.agentListTitle', { defaultValue: 'Participant registry' })}
        title={t('experimentBuilder.step4.agentListTitle')}
        description={t('experimentBuilder.step4.totalAgents', { count: totalAgents })}
      >
        <div className="ss-workflow-summary-grid">
          <SummaryInfoCard
            label={t('common.agents', { defaultValue: 'Agents' })}
            value={totalAgents}
          />
          <SummaryInfoCard
            label={t('experimentBuilder.step4.collectionLabel', { defaultValue: 'Collections' })}
            value={agentCollections.length}
          />
          <SummaryInfoCard
            label={t('simulationWorkspace.provider', { defaultValue: 'Providers' })}
            value={providerCount}
          />
          <SummaryInfoCard
            label={t('experimentBuilder.step4.sharedPropertyBadge', { defaultValue: 'Shared props' })}
            value={sharedPropertyCount}
          />
        </div>

        {agentTypes.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">{t('experimentBuilder.step4.noTypes')}</p>
        ) : (
          <div className="ss-participant-workflow__registry">
            <aside className="ss-participant-workflow__directory">
              <div className="ss-participant-workflow__search">
                <Search size={14} className="text-gray-400" />
                <input
                  value={agentDirectoryQuery}
                  onChange={(e) => setAgentDirectoryQuery(e.target.value)}
                  placeholder={t('experimentBuilder.step4.searchAgents', { defaultValue: 'Search collections or representative profiles' })}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <div className="mt-3 space-y-2 max-h-[720px] overflow-y-auto pr-1">
                {filteredAgentCollections.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    {t('experimentBuilder.step4.noDirectoryResults', {
                      defaultValue: 'No collections match the current search.',
                    })}
                  </div>
                ) : filteredAgentCollections.map((collection) => {
                  const providerLabel =
                    llmProviders.find((provider) => provider.id === collection.providerId)?.name ||
                    t('experimentBuilder.step4.defaultProvider');
                  const isSelected = selectedCollection?.key === collection.key;
                  return (
                    <ParticipantCard
                      key={collection.key}
                      onClick={() => setSelectedEditorAgentId(collection.representative.id)}
                      selected={isSelected}
                      title={collection.title}
                      tag={showTierControls && collection.tier ? collection.tier : providerLabel}
                      description={
                        collection.representative.userProfile ||
                        collection.representative.rolePrompt ||
                        t('experimentBuilder.step4.noProperties')
                      }
                      meta={[
                        t('experimentBuilder.step4.agentsDefined', {
                          count: collection.count,
                          defaultValue: '{{count}} agents',
                        }),
                        `${collection.propertyCount} ${t('experimentBuilder.step4.properties').toLowerCase()}`,
                      ]}
                    />
                  );
                })}
              </div>
            </aside>

            {selectedEditorAgent ? (
              <div className="ss-participant-workflow__editor">
                {selectedCollection ? (
                  <div className="ss-participant-workflow__collection-summary">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="ss-workflow-kicker">
                          {t('experimentBuilder.step4.collectionLabel', { defaultValue: 'Agent collection' })}
                        </div>
                        <div className="mt-1 text-base font-semibold text-slate-900">
                          {selectedCollection.title}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {t('experimentBuilder.step4.collectionHint', {
                            defaultValue: 'The main editor shows one representative profile for this category. Use the roster below if you need to inspect or tweak individual members.',
                          })}
                        </p>
                      </div>
                      <div className="ss-workflow-summary-grid">
                        <SummaryInfoCard
                          label={t('experimentBuilder.step4.collectionMembers', { defaultValue: 'Members' })}
                          value={selectedCollection.count}
                        />
                        <SummaryInfoCard
                          label={t('experimentBuilder.step4.sharedPropertyBadge', { defaultValue: 'Shared' })}
                          value={selectedCollection.propertyCount}
                        />
                        <SummaryInfoCard
                          label={t('experimentBuilder.step4.representativeLabel', { defaultValue: 'Representative' })}
                          value={selectedCollection.representative.label}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="ss-participant-workflow__editor-head">
                  <img
                    src={selectedEditorAvatarUrl}
                    alt={selectedEditorAgent.label}
                    className="w-12 h-12 rounded-full border border-gray-200 bg-gray-50"
                  />
                  <div className="ss-participant-workflow__fields">
                    <FieldBlock label={t('experimentBuilder.step4.agentName')}>
                      <input
                        type="text"
                        value={selectedEditorAgent.label}
                        onChange={(e) => updateAgentType(selectedEditorAgent.id, { label: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                      />
                    </FieldBlock>
                    {showTierControls && (
                      <FieldBlock label={t('experimentBuilder.step4.tier')}>
                        <select
                          value={selectedEditorTier}
                          onChange={(e) => handleUpdateTier(selectedEditorAgent.id, e.target.value as TierValue)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                        >
                          <option value="">{t('experimentBuilder.step4.autoDetectTier')}</option>
                          {tierOrder.map((tierOption) => (
                            <option key={tierOption} value={tierOption}>{tierOption}</option>
                          ))}
                        </select>
                      </FieldBlock>
                    )}
                    <FieldBlock
                      label={t('experimentBuilder.step4.userProfile')}
                      className="md:col-span-2"
                    >
                      <input
                        type="text"
                        value={selectedEditorAgent.userProfile || ''}
                        onChange={(e) => updateAgentType(selectedEditorAgent.id, { userProfile: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                      />
                    </FieldBlock>
                    <FieldBlock
                      label={t('experimentBuilder.step4.rolePrompt')}
                      helper={t('experimentBuilder.step4.rolePromptHelper', {
                        defaultValue: '用一句话说明这个群体在实验中的角色、立场或行动倾向。',
                      })}
                      className="md:col-span-2"
                    >
                      <textarea
                        value={selectedEditorAgent.rolePrompt || ''}
                        onChange={(e) => updateAgentType(selectedEditorAgent.id, { rolePrompt: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                      />
                    </FieldBlock>
                    <FieldBlock label={t('experimentBuilder.step4.llmProvider')}>
                      <select
                        value={selectedEditorAgent.providerId ?? ''}
                        onChange={(e) => updateAgentType(selectedEditorAgent.id, { providerId: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white"
                      >
                        <option value="">{t('experimentBuilder.step4.defaultProvider')}</option>
                        {llmProviders.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.model ? ` (${p.model})` : ''}</option>
                        ))}
                      </select>
                    </FieldBlock>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAgentType(selectedEditorAgent.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    {t('experimentBuilder.step4.remove')}
                  </Button>
                </div>

                {selectedCollection && selectedCollection.members.length > 1 ? (
                  <div className="mb-4 rounded-md border border-gray-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-700">
                        {t('experimentBuilder.step4.memberRoster', { defaultValue: 'Member roster' })}
                      </div>
                      <span className="text-xs text-gray-500">
                        {t('experimentBuilder.step4.memberRosterHint', {
                          defaultValue: 'Switch members without reopening the whole category.',
                        })}
                      </span>
                    </div>
                    <div className="ss-participant-workflow__member-grid">
                      {selectedCollection.members.map((member) => (
                        <ParticipantCard
                          key={member.id}
                          onClick={() => setSelectedEditorAgentId(member.id)}
                          selected={member.id === selectedEditorAgent.id}
                          title={member.label}
                          description={
                            member.userProfile ||
                            member.rolePrompt ||
                            t('experimentBuilder.step4.noProperties')
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-md bg-gray-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-medium text-gray-700">{t('experimentBuilder.step4.properties')}</div>
                    <Button size="sm" variant="outline" onClick={() => handleAddProperty(selectedEditorAgent.id)}>
                      {t('experimentBuilder.step4.addProperty')}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {selectedEditableProperties.length === 0 && (
                      <div className="text-xs text-gray-500">{t('experimentBuilder.step4.noProperties')}</div>
                    )}
                    {selectedEditableProperties.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={item.key}
                            onChange={(e) => handleDraftPropertyChange(selectedEditorAgent.id, item.id, 'key', e.target.value)}
                            onBlur={() => handleCommitPropertyKey(selectedEditorAgent.id, item.id)}
                            className="w-full px-2 py-1.5 pr-14 text-sm border border-gray-300 rounded bg-white"
                          />
                          {(sharedPropertyOwners[item.originalKey] || []).length > 1 && (
                            <span
                              title={t('experimentBuilder.step4.sharedPropertyTooltip', {
                                key: item.originalKey,
                                agents: sharedPropertyOwners[item.originalKey].join('、'),
                              })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 cursor-help"
                            >
                              {t('experimentBuilder.step4.sharedPropertyBadge')}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => handleDraftPropertyChange(selectedEditorAgent.id, item.id, 'value', e.target.value)}
                          onBlur={() => handleCommitPropertyValue(selectedEditorAgent.id, item.id)}
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProperty(selectedEditorAgent.id, item.originalKey)}
                          className="text-red-600 hover:text-red-700"
                        >
                          {t('experimentBuilder.step4.remove')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </ResearchInputPanel>

      {/* File Import */}
      {agentMode === 'import' && (
        <ResearchInputPanel
          eyebrow={t('experimentBuilder.step4.importTitle')}
          title={t('experimentBuilder.step4.importTitle')}
          description={t('experimentBuilder.step4.importDesc')}
        >

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('experimentBuilder.step4.csvFormat')}</label>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                <code>name,role_prompt,user_profile,opinion</code>
              </pre>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" component="label">
                <input type="file" accept=".csv,.json" className="hidden" />
                {t('experimentBuilder.step4.uploadCSV')}
              </Button>
              <Button variant="outline" component="label">
                <input type="file" accept=".csv,.json" className="hidden" />
                {t('experimentBuilder.step4.uploadJSON')}
              </Button>
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm text-blue-800">ℹ️ {t('experimentBuilder.step4.importInfo')}</p>
            </div>
          </div>
        </ResearchInputPanel>
      )}

      {/* Total Agents Summary (shown for all modes) */}
      {totalAgents > 0 && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-green-800">✓</span>
            <span className="text-sm text-green-700">
              {t('experimentBuilder.step4.agentsDefined', { count: totalAgents })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

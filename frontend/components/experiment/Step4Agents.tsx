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
import { buildAgentCollections } from '../../utils/agentCollections';
import { applyLlmDistribution } from '../../utils/llmDistribution';
import { Step4AgentRegistryPanel } from './step4Agents/Step4AgentRegistryPanel';
import { ResearchInputPanel } from './workflow/ResearchInputPanel';
import {
  buildXihuYilianbaoDefaultAgents,
  buildXihuYilianbaoDefaultNetwork,
  defaultTierName,
  focusStepFourElement,
  generateArchetypes,
  generateId,
  inferOrderedTier,
  inferTierFromAgent,
  isPolicyCascadeScenario,
  parseTierOrder,
  resizeTierOrder,
  type EditablePropertyDraft,
  type TierValue,
  XIHU_YILIANBAO_SCENARIO_ID,
} from './step4Agents/utils';

const DEFAULT_DEMOGRAPHIC_PRESETS = {
  en: [
    { name: 'Age', categories: ['18-30', '31-50', '51+'] },
    { name: 'Location', categories: ['Urban', 'Suburban', 'Rural'] },
  ],
  zh: [
    { name: '年龄', categories: ['18-30', '31-50', '51岁以上'] },
    { name: '地区', categories: ['城市', '郊区', '农村'] },
  ],
};

const demographicLocale = (language: string) => (language.toLowerCase().startsWith('zh') ? 'zh' : 'en');

const matchesDefaultDemographicPreset = (items: Demographic[], language: string) => {
  const preset = DEFAULT_DEMOGRAPHIC_PRESETS[demographicLocale(language)];
  return items.length === preset.length && preset.every((demo, index) => (
    items[index].name === demo.name && items[index].categories.join('|') === demo.categories.join('|')
  ));
};

const matchesAnyDefaultDemographicPreset = (items: Demographic[]) => (
  matchesDefaultDemographicPreset(items, 'en') || matchesDefaultDemographicPreset(items, 'zh')
);

const buildDefaultDemographics = (language: string): Demographic[] => (
  DEFAULT_DEMOGRAPHIC_PRESETS[demographicLocale(language)].map((demo) => ({
    id: generateId(),
    name: demo.name,
    categories: [...demo.categories],
  }))
);

const IMPORT_CORE_FIELDS = new Set(['name', 'role_prompt', 'user_profile', 'count', 'properties']);

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(cell.trim());
      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((item) => item.length > 0)) {
    rows.push(row);
  }

  return rows;
};

const parseCsvAgentRows = (text: string) => {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one agent row.');
  }

  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim());
  const nameIndex = headers.indexOf('name');
  if (nameIndex === -1) {
    throw new Error('CSV header must include name.');
  }

  return rows.slice(1).map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
};

const parseJsonAgentRows = (text: string) => {
  return JSON.parse(text) as Array<Record<string, unknown>>;
};

const buildImportedAgentTypes = (
  rows: Array<Record<string, unknown>>,
  selectedProviderId: number | null,
): ManualAgentType[] => {
  const timestamp = Date.now();
  return rows.map((row, index) => {
    const label = String(row.name ?? '').trim();
    if (!label) {
      throw new Error(`Imported agent row ${index + 1} is missing name.`);
    }

    const properties = { ...((row.properties ?? {}) as Record<string, unknown>) };

    Object.entries(row).forEach(([key, value]) => {
      if (!IMPORT_CORE_FIELDS.has(key) && value !== '') {
        properties[key] = value;
      }
    });

    const count = Math.max(1, Math.floor(Number(row.count ?? 1)));
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';

    return {
      id: `import-${timestamp}-${index + 1}-${slug}`,
      label,
      count,
      rolePrompt: String(row.role_prompt ?? '').trim(),
      userProfile: String(row.user_profile ?? '').trim(),
      properties,
      providerId: selectedProviderId,
    };
  });
};

// =============================================================================
// Component
// =============================================================================

export const Step4Agents: React.FC = () => {
  const { t, i18n } = useTranslation();
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
    llmAllocations,
    addLlmAllocation,
    removeLlmAllocation,
    updateLlmAllocation,
    scenarioParams,
    setScenarioParams,
    socialNetwork,
    setSocialNetwork,
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
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, EditablePropertyDraft[]>>({});
  const [genCount, setGenCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAgents, setGeneratedAgents] = useState<Agent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [tierOrderDraft, setTierOrderDraft] = useState<string[]>(['top', 'mid', 'low']);
  const [agentDirectoryQuery, setAgentDirectoryQuery] = useState('');
  const [selectedEditorAgentId, setSelectedEditorAgentId] = useState<string | null>(null);

  const scenarioId = selectedScenarioData?.id || selectedScenarioId || '';
  const scenarioName = (selectedScenarioData?.name || '').toLowerCase();
  const showTierControls = isPolicyCascadeScenario(scenarioId, scenarioName);
  const isXihuYilianbaoScenario = scenarioId === XIHU_YILIANBAO_SCENARIO_ID;
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
    if (!isXihuYilianbaoScenario) return;
    if (agentTypes.length === 0) {
      buildXihuYilianbaoDefaultAgents().forEach(addAgentType);
    }
    if (Object.keys(socialNetwork).length === 0) {
      setSocialNetwork(buildXihuYilianbaoDefaultNetwork());
    }
  }, [
    addAgentType,
    agentTypes.length,
    isXihuYilianbaoScenario,
    setSocialNetwork,
    socialNetwork,
  ]);

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
    const hasDefaultDemographics = matchesAnyDefaultDemographicPreset(demographics);
    const hasCurrentLanguageDefaults = matchesDefaultDemographicPreset(demographics, i18n.language);
    if (demographics.length === 0 || hasPolicyOnlyDemographics || (hasDefaultDemographics && !hasCurrentLanguageDefaults)) {
      setDemographics(buildDefaultDemographics(i18n.language));
    }
  }, [showTierControls, demographics, genCount, tierOrder, i18n.language]);

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

  const handleImportAgentFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
    format: 'csv' | 'json',
  ) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    event.currentTarget.value = '';
    setImportSuccess(null);

    const text = await file.text();
    const rows = format === 'csv' ? parseCsvAgentRows(text) : parseJsonAgentRows(text);
    const importedAgents = buildImportedAgentTypes(rows, selectedProviderId);
    if (importedAgents.length === 0) {
      throw new Error('File did not contain any agent rows.');
    }

    importedAgents.forEach(addAgentType);
    setSelectedEditorAgentId(importedAgents[0].id);
    setImportError(null);
    setImportSuccess(t('experimentBuilder.step4.importSuccess', {
      count: importedAgents.reduce((sum, agent) => sum + agent.count, 0),
      file: file.name,
    }));
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
      const generated = await generateAgentsWithDemographics(
        genCount,
        demographicsData,
        archetypeProbabilities,
        traitsData,
        currentLang,
        selectedProviderId ?? undefined
      );

      const defaultProvider = llmProviders.find((provider) => provider.id === selectedProviderId) || llmProviders[0];
      const distributedAgents = applyLlmDistribution(
        generated,
        llmAllocations,
        `${scenarioId || 'experiment'}:${selectedProviderId || 'default'}:${genCount}`,
        {
          provider: defaultProvider?.provider || generated[0]?.llmConfig?.provider || 'backend',
          model: defaultProvider?.model || generated[0]?.llmConfig?.model || 'default',
          provider_id: defaultProvider?.id ?? selectedProviderId ?? generated[0]?.provider_id ?? null,
        },
      );

      setGeneratedAgents(distributedAgents);

      // Convert generated agents to ManualAgentType format and add to store
      distributedAgents.forEach((agent) => {
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
          id: agent.id,
          label: agent.name,
          count: 1,
          rolePrompt: agent.profile,
          userProfile: agent.profile,
          properties: nextProperties,
          providerId: agent.provider_id ?? undefined,
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

  useEffect(() => {
    const handleGuideFocus = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ target?: string }>;
      const target = event.detail?.target;

      if (target === 'mode') {
        focusStepFourElement('ss-step4-mode-grid');
        return;
      }

      if (target === 'provider') {
        if (agentMode !== 'demographic') {
          setAgentMode('demographic');
          window.setTimeout(() => focusStepFourElement('ss-step4-provider-selector'), 180);
          return;
        }
        focusStepFourElement('ss-step4-provider-selector');
        return;
      }

      if (target === 'registry') {
        focusStepFourElement('ss-step4-participant-registry');
        return;
      }

      if (target === 'editor') {
        focusStepFourElement('ss-step4-participant-editor');
        return;
      }

      if (target === 'name') {
        if (agentTypes.length === 0 || agentMode !== 'manual') {
          setAgentMode('manual');
          window.setTimeout(() => focusStepFourElement('ss-step4-new-type-name'), 180);
          return;
        }

        const selectedNameInput = document.getElementById('ss-step4-editor-name');
        if (selectedNameInput) {
          focusStepFourElement('ss-step4-editor-name');
          return;
        }

        focusStepFourElement('ss-step4-new-type-name');
      }
    };

    window.addEventListener('ss-step4-guide', handleGuideFocus as EventListener);
    return () => window.removeEventListener('ss-step4-guide', handleGuideFocus as EventListener);
  }, [agentMode, agentTypes.length, setAgentMode]);

  // ==================== Render ====================

  return (
    <div className="ss-participant-workflow">
      <ResearchInputPanel
        eyebrow={t('experimentBuilder.step4.title', { defaultValue: isZh() ? '智能体配置' : 'Agent setup' })}
        title={t('experimentBuilder.step4.modeTitle')}
        description={t('experimentBuilder.step4.modeDescription', {
          defaultValue:
            '先确定智能体的组织方式，再逐步补充代表样本与研究属性。',
        })}
      >
        <div id="ss-step4-mode-grid" className="ss-participant-workflow__mode-grid">
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
              <div className="ss-participant-workflow__manual-note mt-3 text-xs">
                {t('experimentBuilder.step4.tierDraftPending')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Agent Types */}
      {agentMode === 'manual' && (
        <ResearchInputPanel
          eyebrow={t('experimentBuilder.step4.defineTypes', { defaultValue: 'Agent form' })}
          title={t('experimentBuilder.step4.defineTypes')}
          description={t('experimentBuilder.step4.manualHint')}
        >
        <div className="ss-participant-workflow__manual-note mb-4 px-4 py-3 text-sm">
            {isZh() ? '先创建一个基础智能体类型即可，后续仍可继续补充。' : t('experimentBuilder.step4.manualHint')}
          </div>

          {/* Add New Agent Type */}
          <div id="ss-step4-new-type" className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('experimentBuilder.step4.typeLabel')}</label>
                <input
                  id="ss-step4-new-type-name"
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
                <textarea
                  value={newAgentType.userProfile}
                  onChange={(e) => setNewAgentType({ ...newAgentType, userProfile: e.target.value })}
                  rows={5}
                  placeholder={t('experimentBuilder.step4.userProfilePlaceholder')}
                  className="ss-participant-workflow__profile-textarea"
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
                className="ss-participant-workflow__profile-textarea is-compact"
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
          eyebrow={t('experimentBuilder.step4.demographicEyebrow', { defaultValue: 'Group generation' })}
          title={t('experimentBuilder.step4.demographicTitle', { defaultValue: 'Demographic generation' })}
            description={t('experimentBuilder.step4.demographicDescription', {
              defaultValue: '先定义人口结构，再据此生成代表性的智能体集合。',
            })}
        >
          {/* LLM Provider Selector */}
          {llmProviders.length > 0 && (
            <div id="ss-step4-provider-selector" className="ss-participant-workflow__provider">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('experimentBuilder.step4.llmProvider')}</label>
              <select
                value={selectedProviderId || ''}
                onChange={(e) => setSelectedProviderId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">{t('experimentBuilder.step4.defaultProvider')}</option>
                {llmProviders.map((p: LLMProvider) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.model ? ` (${p.model})` : ''}
                    {p.is_active ? ` ● ${t('experimentBuilder.step4.providerActive', { defaultValue: 'Active' })}` : ''}
                    {p.is_default ? ` ● ${t('experimentBuilder.step4.providerDefault', { defaultValue: 'Default' })}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Use the flexible demographic editor */}
          <div className="ss-participant-workflow__demographic-shell">
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
              llmAllocations={llmAllocations}
              onAddLlmAllocation={addLlmAllocation}
              onRemoveLlmAllocation={removeLlmAllocation}
              onUpdateLlmAllocation={updateLlmAllocation}
              availableProviders={llmProviders as any}
              providersLoading={false}
              useTranslation
              t={t}
            />
          </div>
        </ResearchInputPanel>
      )}

      <Step4AgentRegistryPanel
        t={t}
        totalAgents={totalAgents}
        agentTypes={agentTypes}
        agentCollections={agentCollections}
        providerCount={providerCount}
        sharedPropertyCount={sharedPropertyCount}
        filteredAgentCollections={filteredAgentCollections}
        selectedCollection={selectedCollection}
        selectedEditorAgent={selectedEditorAgent}
        selectedEditorAvatarUrl={selectedEditorAvatarUrl}
        selectedEditorTier={selectedEditorTier}
        selectedEditableProperties={selectedEditableProperties}
        sharedPropertyOwners={sharedPropertyOwners}
        llmProviders={llmProviders}
        tierOrder={tierOrder}
        showTierControls={showTierControls}
        agentDirectoryQuery={agentDirectoryQuery}
        setAgentDirectoryQuery={setAgentDirectoryQuery}
        setSelectedEditorAgentId={setSelectedEditorAgentId}
        updateAgentType={updateAgentType}
        removeAgentType={removeAgentType}
        handleUpdateTier={handleUpdateTier}
        handleAddProperty={handleAddProperty}
        handleDraftPropertyChange={handleDraftPropertyChange}
        handleCommitPropertyKey={handleCommitPropertyKey}
        handleCommitPropertyValue={handleCommitPropertyValue}
        handleRemoveProperty={handleRemoveProperty}
      />

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
                <code>name,role_prompt,user_profile,opinion,count</code>
              </pre>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('experimentBuilder.step4.jsonFormat')}
              </label>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                <code>{'[{"name":"Alice","role_prompt":"Policy supporter","user_profile":"Urban resident","opinion":"support"}]'}</code>
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--ss-border)] bg-[var(--ss-surface)] px-3.5 py-2 text-sm font-medium text-[var(--ss-text)] transition-all hover:-translate-y-0.5 hover:border-[var(--ss-border-strong)]">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => handleImportAgentFile(event, 'csv')}
                />
                {t('experimentBuilder.step4.uploadCSV')}
              </label>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--ss-border)] bg-[var(--ss-surface)] px-3.5 py-2 text-sm font-medium text-[var(--ss-text)] transition-all hover:-translate-y-0.5 hover:border-[var(--ss-border-strong)]">
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(event) => handleImportAgentFile(event, 'json')}
                />
                {t('experimentBuilder.step4.uploadJSON')}
              </label>
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm text-blue-800">ℹ️ {t('experimentBuilder.step4.importInfo')}</p>
            </div>
            {importSuccess && (
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p className="text-sm text-green-800">{importSuccess}</p>
              </div>
            )}
            {importError && (
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <p className="text-sm text-red-800">{importError}</p>
              </div>
            )}
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

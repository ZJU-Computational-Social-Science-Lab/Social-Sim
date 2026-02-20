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
import { useExperimentBuilder, ManualAgentType, LLMProvider } from '../../store/experiment-builder';
import { generateAgentsWithDemographics, isZh } from '../../store/helpers';
import { Step2DemographicsEditor, Demographic, Archetype, TraitConfig } from '../wizard/Step2DemographicsEditor';
import type { Agent } from '../../types';
import { Button } from '../ui/button';

// =============================================================================
// Helper Functions
// =============================================================================

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
    loadProviders,
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
    properties: {},
  });

  // ==================== Demographic Mode State ====================

  const [demographics, setDemographics] = useState<Demographic[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [traits, setTraits] = useState<TraitConfig[]>([
    { id: generateId(), name: 'Trust', mean: 50, std: 15 }
  ]);
  const [genCount, setGenCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAgents, setGeneratedAgents] = useState<Agent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Initialize demographics on first render
  useEffect(() => {
    if (demographics.length === 0) {
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
  }, []);

  // Update archetypes when demographics change
  useEffect(() => {
    if (demographics.length > 0 && demographics.every(d => d.categories.length > 0)) {
      setArchetypes(generateArchetypes(demographics));
    } else {
      setArchetypes([]);
    }
  }, [demographics]);

  // ==================== Agent Mode Options ====================

  const agentModes = [
    {
      id: 'manual',
      title: 'Manual Types',
      description: 'Define agent types manually for precise experiments',
      icon: '✏️',
    },
    {
      id: 'demographic',
      title: 'Demographic Generation',
      description: 'Generate agents from custom demographic variables',
      icon: '👥',
    },
    {
      id: 'import',
      title: 'File Import',
      description: 'Upload CSV or JSON files with agent data',
      icon: '📁',
    },
  ];

  // ==================== Manual Mode Handlers ====================

  const handleAddAgentType = () => {
    if (!newAgentType.label.trim()) return;
    addAgentType({
      ...newAgentType,
      id: newAgentType.id || `agent-${Date.now()}`,
    });
    setNewAgentType({
      id: '',
      label: '',
      count: 1,
      rolePrompt: '',
      userProfile: '',
      properties: {},
    });
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
        const agentType: ManualAgentType = {
          id: `demo-agent-${agent.id}`,
          label: agent.name,
          count: 1,
          rolePrompt: agent.profile,
          userProfile: agent.profile,
          properties: {
            avatarUrl: agent.avatarUrl,
            ...agent.properties,
            archetype_id: agent.properties?.archetype_id || '',
            demographic_attributes: JSON.stringify(agent.properties || {}),
          },
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

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          How would you like to create agents?
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {agentModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setAgentMode(mode.id as 'manual' | 'demographic' | 'import')}
              className={`
                p-4 border-2 rounded-lg text-left transition-all bg-white
                ${agentMode === mode.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span className="text-2xl mb-2 block">{mode.icon}</span>
              <h4 className="font-semibold text-gray-900">{mode.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{mode.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Manual Agent Types */}
      {agentMode === 'manual' && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <h4 className="font-semibold text-gray-900 mb-3">Define Agent Types</h4>

          {/* Add New Agent Type */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type Label</label>
                <input
                  type="text"
                  value={newAgentType.label}
                  onChange={(e) => setNewAgentType({ ...newAgentType, label: e.target.value })}
                  placeholder="e.g., Participant"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Count</label>
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
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Role Prompt (what is this agent's role?)
              </label>
              <textarea
                value={newAgentType.rolePrompt}
                onChange={(e) => setNewAgentType({ ...newAgentType, rolePrompt: e.target.value })}
                placeholder="e.g., A concerned citizen interested in policy..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                rows={2}
              />
            </div>
            <Button onClick={handleAddAgentType} size="sm" disabled={!newAgentType.label.trim()}>
              + Add Agent Type
            </Button>
          </div>

          {/* Agent Types List */}
          {agentTypes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No agent types defined yet</p>
          ) : (
            <div className="space-y-2">
              {agentTypes.map((type) => {
                // Generate avatar URL from seed if not in properties
                const avatarUrl = type.properties?.avatarUrl as string ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(type.label)}`;
                return (
                  <div
                    key={type.id}
                    className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-md"
                  >
                    <img
                      src={avatarUrl}
                      alt={type.label}
                      className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{type.label}</span>
                        <span className="text-sm text-gray-500">({type.count})</span>
                      </div>
                      {type.userProfile && (
                        <p className="text-xs text-gray-600 truncate mt-1" title={type.userProfile}>
                          {type.userProfile}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAgentType(type.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {totalAgents > 0 && (
            <div className="mt-3 text-sm text-gray-600">Total agents: {totalAgents}</div>
          )}
        </div>
      )}

      {/* Demographic Generation */}
      {agentMode === 'demographic' && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          {/* LLM Provider Selector */}
          {llmProviders.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">LLM Provider</label>
              <select
                value={selectedProviderId || ''}
                onChange={(e) => setSelectedProviderId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">Default Provider</option>
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
        </div>
      )}

      {/* File Import */}
      {agentMode === 'import' && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <h4 className="font-semibold text-gray-900 mb-3">Import Agent Data</h4>
          <p className="text-sm text-gray-600 mb-3">
            Upload a CSV or JSON file with agent definitions.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CSV Format Example:</label>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                <code>name,role_prompt,user_profile,opinion</code>
              </pre>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" component="label">
                <input type="file" accept=".csv,.json" className="hidden" />
                Upload CSV
              </Button>
              <Button variant="outline" component="label">
                <input type="file" accept=".csv,.json" className="hidden" />
                Upload JSON
              </Button>
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm text-blue-800">ℹ️ File import will be implemented in Phase 7.</p>
            </div>
          </div>
        </div>
      )}

      {/* Total Agents Summary (shown for all modes) */}
      {totalAgents > 0 && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-green-800">✓</span>
            <span className="text-sm text-green-700">
              {totalAgents} agent{totalAgents !== 1 ? 's' : ''} defined
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

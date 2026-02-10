/**
 * SimulationWizard component - Main orchestrator for simulation creation wizard.
 *
 * This is a refactored version that delegates UI rendering to focused subcomponents
 * while maintaining complex state management and event handling logic.
 *
 * The wizard consists of 3 steps:
 *   Step 1: Template selection, time configuration, basic info
 *   Step 2: Agent import/generation (default, AI generate, file import)
 *   Step 3: Confirmation summary
 *
 * Complex features:
 *   - Template selection with system/custom/custom builder modes
 *   - Time configuration with multiple units
 *   - AI agent generation with demographics support
 *   - CSV/JSON file import for agents
 *   - LLM provider selection
 *
 * Sub-components are imported from ./wizard package:
 *   - WizardHeader, WizardFooter
 *   - ProviderSelector, Step1TemplateSelection, Step1TimeConfiguration, Step1BasicInfo
 *   - Step2ImportModeSelector, Step2DefaultMode, Step3Confirmation
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  Users,
  Sparkles,
  Loader2,
  Plus,
  Minus,
} from 'lucide-react';
import Papa from 'papaparse';
import { Agent, LLMConfig, TimeUnit, GenericTemplateConfig, Template } from '../types';
import { uploadImage } from '../services/uploads';
import { TemplateBuilder, createEmptyGenericTemplate } from './TemplateBuilder';
import {
  generateAgentsWithAI,
  generateAgentsWithDemographics,
  useSimulationStore,
} from '../store';
import {
  WizardHeader,
  WizardFooter,
  ProviderSelector,
  Step1TemplateSelection,
  Step1TimeConfiguration,
  Step1BasicInfo,
  Step2ImportModeSelector,
  Step2DefaultMode,
  Step3Confirmation,
} from './wizard';

// =============================================================================
// Types for Demographic Generation (AgentTorch Integration)
// =============================================================================

interface Demographic {
  id: string;
  name: string;
  categories: string[];
}

interface Archetype {
  id: string;
  attributes: Record<string, string>;
  label: string;
  probability: number;
}

interface TraitConfig {
  id: string;
  name: string;
  mean: number;
  std: number;
}

// Helper to generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Generate archetypes from demographics (cross-product) - UI helper only
const generateArchetypes = (demographics: Demographic[]): Archetype[] => {
  if (demographics.length === 0) return [];

  let combinations: Record<string, string>[] = demographics[0].categories.map(cat => ({
    [demographics[0].name]: cat
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
    label: Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(' | '),
    probability: equalProb
  }));
};

export const SimulationWizard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isOpen = useSimulationStore((state) => state.isWizardOpen);
  const toggleWizard = useSimulationStore((state) => state.toggleWizard);
  const addSimulation = useSimulationStore((state) => state.addSimulation);
  const savedTemplates = useSimulationStore((state) => state.savedTemplates);
  const deleteTemplate = useSimulationStore((state) => state.deleteTemplate);
  const addNotification = useSimulationStore((state) => state.addNotification);
  const isGeneratingGlobal = useSimulationStore((s) => s.isGenerating);

  // provider related
  const llmProviders = useSimulationStore((s) => s.llmProviders);
  const selectedProviderId = useSimulationStore((s) => s.selectedProviderId);
  const setSelectedProvider = useSimulationStore((s) => s.setSelectedProvider);
  const loadProviders = useSimulationStore((s) => s.loadProviders);

  // ============================================================================
  // State
  // ============================================================================

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('village');
  const [activeTab, setActiveTab] = useState<'system' | 'custom'>('system');

  // Custom Template Mode
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [genericTemplate, setGenericTemplate] = useState<GenericTemplateConfig>(createEmptyGenericTemplate());

  const [baseTime, setBaseTime] = useState(new Date().toISOString().slice(0, 16));
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('hour');
  const [timeStep, setTimeStep] = useState(1);

  const [importMode, setImportMode] = useState<'default' | 'custom' | 'generate'>('default');
  const [customAgents, setCustomAgents] = useState<Agent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const [genCount, setGenCount] = useState(5);
  const [genDesc, setGenDesc] = useState('');
  const [isEmbeddingImage, setIsEmbeddingImage] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Demographic-based generation fields (AgentTorch)
  const [useDemographics, setUseDemographics] = useState(true);
  const [demographics, setDemographics] = useState<Demographic[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [traits, setTraits] = useState<TraitConfig[]>([
    { id: generateId(), name: t('wizard.defaults.traits.trust'), mean: 50, std: 15 },
    { id: generateId(), name: t('wizard.defaults.traits.empathy'), mean: 50, std: 15 },
    { id: generateId(), name: t('wizard.defaults.traits.assertiveness'), mean: 50, std: 15 }
  ]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Load providers and initialize on open
  useEffect(() => {
    if (isOpen) {
      loadProviders();
      // Initialize demographics on open
      if (demographics.length === 0) {
        setDemographics([
          { id: generateId(), name: t('wizard.tabs.age'), categories: [
            t('wizard.defaults.ageRanges.young'),
            t('wizard.defaults.ageRanges.middle'),
            t('wizard.defaults.ageRanges.senior')
          ] },
          { id: generateId(), name: t('wizard.tabs.location'), categories: [
            t('wizard.defaults.categories.urban'),
            t('wizard.defaults.categories.suburban'),
            t('wizard.defaults.categories.rural')
          ] }
        ]);
      }
      // Set default description if empty
      if (!genDesc) {
        setGenDesc(t('wizard.templateDefaults.village'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loadProviders]);

  // Update demographics when language changes
  useEffect(() => {
    if (demographics.length >= 2) {
      setDemographics([
        { id: demographics[0].id, name: t('wizard.tabs.age'), categories: [
          t('wizard.defaults.ageRanges.young'),
          t('wizard.defaults.ageRanges.middle'),
          t('wizard.defaults.ageRanges.senior')
        ] },
        { id: demographics[1].id, name: t('wizard.tabs.location'), categories: [
          t('wizard.defaults.categories.urban'),
          t('wizard.defaults.categories.suburban'),
          t('wizard.defaults.categories.rural')
        ] }
      ]);
    }
    // Update traits when language changes
    setTraits([
      { id: traits[0]?.id || generateId(), name: t('wizard.defaults.traits.trust'), mean: 50, std: 15 },
      { id: traits[1]?.id || generateId(), name: t('wizard.defaults.traits.empathy'), mean: 50, std: 15 },
      { id: traits[2]?.id || generateId(), name: t('wizard.defaults.traits.assertiveness'), mean: 50, std: 15 }
    ]);
  }, [i18n.language]);

  // Auto-adjust generation description and count based on template
  useEffect(() => {
    const defaults: Record<string, string> = {
      village: t('wizard.templateDefaults.village'),
      council: t('wizard.templateDefaults.council'),
      werewolf: t('wizard.templateDefaults.werewolf')
    };
    setGenDesc(defaults[selectedTemplateId] || defaults['village']);
    const counts: Record<string, number> = {
      village: 5,
      council: 5,
      werewolf: 9
    };
    setGenCount(counts[selectedTemplateId] ?? 5);
  }, [selectedTemplateId, t]);

  // Update archetypes when demographics change (AgentTorch)
  useEffect(() => {
    if (useDemographics) {
      setArchetypes(generateArchetypes(demographics));
    }
  }, [demographics, useDemographics]);

  // ============================================================================
  // Derived State
  // ============================================================================

  const selectedTemplate = savedTemplates.find((tpl) => tpl.id === selectedTemplateId) || savedTemplates[0];

  const defaultLlmConfig: LLMConfig = llmProviders.find((p) => p.id === selectedProviderId) ||
    llmProviders.find((p) => (p as any).is_active || (p as any).is_default) ||
    llmProviders[0]
    ? {
        provider: (llmProviders.find((p) => p.id === selectedProviderId) as any)?.name ||
          (llmProviders.find((p) => p.id === selectedProviderId) as any)?.provider ||
          'backend',
        model: (llmProviders.find((p) => p.id === selectedProviderId) as any)?.model || 'default'
      }
    : {
        provider: 'backend',
        model: 'default'
      };

  const visionCapable = !!(
    (llmProviders.find((p) => p.id === selectedProviderId) as any)?.model &&
    /vision|gpt-4o|4o-mini|o1|gemini-pro-vision|gemini 1\.5|flash|pro|llava|llama-?3\.2|qwen2-vl/i.test((llmProviders.find((p) => p.id === selectedProviderId) as any)?.model)
  );

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleEmbedImage = async (file: File | null) => {
    if (!file) return;
    setIsEmbeddingImage(true);
    try {
      const asset = await uploadImage(file);
      setGenDesc((prev) => `${prev}\n![scene image](${asset.url})`);
      addNotification('success', t('wizard.messages.imageUploaded'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('wizard.messages.uploadFailed');
      addNotification('error', message);
    } finally {
      setIsEmbeddingImage(false);
    }
  };

  const handleFinish = () => {
    const agentsToUse = importMode === 'custom' || importMode === 'generate'
      ? customAgents
      : undefined;

    if (agentsToUse) {
      agentsToUse.forEach((a) => {
        if (!a.llmConfig) {
          a.llmConfig = defaultLlmConfig;
        }
      });
    }

    // If using custom template, create a template from generic config
    const templateToUse = useCustomTemplate
      ? {
          id: genericTemplate.id,
          name: genericTemplate.name || t('wizard.defaults.customTemplate'),
          description: genericTemplate.description || '',
          category: 'custom' as const,
          sceneType: 'generic',
          agents: agentsToUse || [],
          defaultTimeConfig: genericTemplate.defaultTimeConfig || {
            baseTime: new Date(baseTime).toISOString(),
            unit: timeUnit,
            step: timeStep
          },
          genericConfig: genericTemplate
        }
      : selectedTemplate;

    addSimulation(name, templateToUse, agentsToUse, {
      baseTime: new Date(baseTime).toISOString(),
      unit: timeUnit,
      step: timeStep
    });

    resetForm();
  };

  const resetForm = () => {
    setStep(1);
    setName('');
    setSelectedTemplateId('village');
    setImportMode('default');
    setCustomAgents([]);
    setImportError(null);
    setGenCount(5);
    setGenDesc(t('wizard.templateDefaults.village'));
    setUseCustomTemplate(false);
    setGenericTemplate(createEmptyGenericTemplate());
  };

  const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(t('wizard.confirmations.deleteTemplate'))) {
      deleteTemplate(id);
      if (selectedTemplateId === id) setSelectedTemplateId('village');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const currentConfig = defaultLlmConfig;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        type RawItem = { row: any; label: string };
        let rawItems: RawItem[] = [];
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.agents;
          if (!Array.isArray(items)) {
            throw new Error(t('wizard.errors.jsonFormatError'));
          }
          rawItems = items.map((row, index) => ({
            row,
            label: t('wizard.errors.itemLabel', { index: index + 1 })
          }));
        } else if (file.name.endsWith('.csv')) {
          const result = Papa.parse(text, {
            header: false,
            skipEmptyLines: true
          });
          if (result.errors.length > 0) {
            throw new Error(
              t('wizard.errors.csvParseError', { message: result.errors[0].message || t('common.loading') })
            );
          }
          const rows = result.data as any[];
          if (!rows || rows.length === 0) {
            throw new Error(t('wizard.errors.csvEmpty'));
          }
          const firstRow = (rows[0] || []).map((v: any) => String(v ?? '').trim());
          const headerLooksLike =
            firstRow.length >= 2 &&
            (firstRow[0] === 'agent_name' ||
              firstRow[1] === 'agent_description' ||
              firstRow[0] === 'name' ||
              firstRow[1] === 'description');
          const header = headerLooksLike ? firstRow : null;
          const dataRows = header ? rows.slice(1) : rows;
          if (dataRows.length === 0) {
            throw new Error(t('wizard.errors.csvEmpty'));
          }
          rawItems = dataRows.map((row: any, index: number) => {
            const values = Array.isArray(row) ? row : Object.values(row);
            if (header) {
              const obj: Record<string, any> = {};
              header.forEach((key, i) => {
                if (key) obj[key] = values[i];
              });
              return { row: obj, label: t('wizard.errors.rowLabel', { index: index + 2 }) };
            }
            const obj: Record<string, any> = {
              agent_name: values[0],
              agent_description: values[1]
            };
            values.slice(2).forEach((val, i) => {
              obj[`attribute${i + 1}`] = val;
            });
            return { row: obj, label: t('wizard.errors.rowLabel', { index: index + 1 }) };
          });
        } else {
          throw new Error(t('wizard.errors.onlySupportCsvJson'));
        }
        const errors: string[] = [];
        const agents: Agent[] = [];
        rawItems.forEach(({ row, label }, index) => {
          if (!row || typeof row !== 'object') {
            errors.push(`${label}：${t('wizard.errors.dataFormatError')}`);
            return;
          }
          const name = row.agent_name ?? row.name;
          const profile = row.agent_description ?? row.profile;
          if (!name || !profile) {
            errors.push(`${label}：${t('wizard.errors.missingRequiredFields')}`);
            return;
          }
          const reservedKeys = new Set([
            'agent_name', 'agent_description', 'name', 'profile', 'id', 'role',
            'avatarUrl', 'properties', 'history', 'memory', 'knowledgeBase', 'llmConfig'
          ]);
          const extraAttributes = Object.fromEntries(
            Object.entries(row).filter(([key]) => !reservedKeys.has(key))
          );
          const properties = {
            ...(row.properties || {}),
            ...extraAttributes
          };
          agents.push({
            id: row.id || `imported_${Date.now()}_${index}`,
            name,
            role: row.role || t('wizard.defaults.citizen'),
            avatarUrl: row.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            profile,
            properties,
            history: row.history || {},
            memory: row.memory || [],
            knowledgeBase: row.knowledgeBase || [],
            llmConfig: row.llmConfig || currentConfig
          });
        });
        setCustomAgents(agents);
        if (errors.length > 0) {
          const detail = errors.slice(0, 5).join('；');
          const more = errors.length > 5
            ? t('wizard.errors.additionalErrors', { count: errors.length - 5 })
            : '';
          setImportError(
            t('wizard.errors.importedWithErrors', {
              count: agents.length,
              errorCount: errors.length,
              detail,
              more
            })
          );
        } else {
          setImportError(null);
        }
      } catch (err) {
        setImportError((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateAgents = async () => {
    setIsGenerating(true);
    setImportError(null);
    try {
      const currentLang = (i18n.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';

      let agents: Agent[];
      if (useDemographics) {
        const archetypeProbs: Record<string, number> = {};
        archetypes.forEach(a => {
          archetypeProbs[a.id] = a.probability;
        });
        agents = await generateAgentsWithDemographics(
          genCount,
          demographics.map(d => ({ name: d.name, categories: d.categories })),
          archetypeProbs,
          traits.map(tr => ({ name: tr.name, mean: tr.mean, std: tr.std })),
          currentLang,
          selectedProviderId ?? undefined
        );
      } else {
        agents = await generateAgentsWithAI(
          genCount,
          genDesc,
          selectedProviderId ?? null,
          currentLang
        );
      }
      agents.forEach((a) => {
        a.llmConfig = defaultLlmConfig;
      });
      setCustomAgents(agents);
      addNotification('success', t('wizard.messages.generatedAgents', { count: agents.length }));
    } catch (e) {
      console.error('Agent generation error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setImportError(`${t('wizard.messages.generationFailed')}: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Demographic management handlers
  const handleAddDemographic = () => {
    setDemographics([...demographics, { id: generateId(), name: t('wizard.defaults.newCategory'), categories: [] }]);
  };

  const handleRemoveDemographic = (id: string) => {
    if (demographics.length > 1) {
      setDemographics(demographics.filter(d => d.id !== id));
    }
  };

  const handleUpdateDemographicName = (id: string, name: string) => {
    setDemographics(demographics.map(d => d.id === id ? { ...d, name } : d));
  };

  const handleUpdateDemographicCategories = (id: string, categories: string) => {
    const cats = categories.split(',').map(c => c.trim()).filter(c => c);
    setDemographics(demographics.map(d => d.id === id ? { ...d, categories: cats } : d));
  };

  const handleUpdateCategoryName = (demoId: string, catIndex: number, value: string) => {
    setDemographics(demographics.map(d => {
      if (d.id === demoId) {
        const newCats = [...d.categories];
        newCats[catIndex] = value;
        return { ...d, categories: newCats };
      }
      return d;
    }));
  };

  const handleAddCategory = (demoId: string) => {
    setDemographics(demographics.map(d => {
      if (d.id === demoId) {
        return { ...d, categories: [...d.categories, t('wizard.defaults.newCategory')] };
      }
      return d;
    }));
  };

  const handleRemoveCategory = (demoId: string, catIndex: number) => {
    setDemographics(demographics.map(d => {
      if (d.id === demoId && d.categories.length > 1) {
        return { ...d, categories: d.categories.filter((_, i) => i !== catIndex) };
      }
      return d;
    }));
  };

  // Trait management handlers
  const handleAddTrait = () => {
    setTraits([...traits, { id: generateId(), name: `${t('wizard.defaults.traits.trust')} ${traits.length + 1}`, mean: 50, std: 15 }]);
  };

  const handleRemoveTrait = (id: string) => {
    if (traits.length > 1) {
      setTraits(traits.filter(t => t.id !== id));
    }
  };

  const handleUpdateTrait = (id: string, field: keyof TraitConfig, value: string | number) => {
    setTraits(traits.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // Archetype probability handlers
  const handleUpdateArchetypeProbability = (archId: string, newProb: number) => {
    const oldProb = archetypes.find(a => a.id === archId)?.probability || 0;
    const currentTotal = archetypes.reduce((sum, a) => sum + a.probability, 0);
    const remainingTotal = currentTotal - oldProb;

    setArchetypes(archetypes.map(a => {
      if (a.id === archId) {
        return { ...a, probability: Math.max(0, Math.min(1, newProb)) };
      } else if (remainingTotal > 0) {
        const scale = (1 - newProb) / remainingTotal;
        return { ...a, probability: Math.max(0, a.probability * scale) };
      }
      return a;
    }));
  };

  const handleNormalizeProbabilities = () => {
    const total = archetypes.reduce((sum, a) => sum + a.probability, 0) || 1;
    setArchetypes(archetypes.map(a => ({ ...a, probability: a.probability / total })));
  };

  // Next step with provider check
  const handleNext = () => {
    if (llmProviders.length === 0 || !selectedProviderId) {
      window.alert(`${t('wizard.alerts.noProviderTitle')}${t('wizard.alerts.noProviderMessage')}`);
      addNotification('error', t('wizard.alerts.noProviderMessage'));
    }
    setStep((s) => s + 1);
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <WizardHeader
          step={step}
          title={t('wizard.titles.createSimulation')}
          onClose={() => toggleWizard(false)}
        />

        {/* Body */}
        <div className="p-8 flex-1 overflow-y-auto">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-8 max-w-3xl mx-auto">
              {/* Provider Selector */}
              <ProviderSelector
                providers={llmProviders}
                selectedProviderId={selectedProviderId}
                onProviderChange={setSelectedProvider}
                title={t('wizard.step1.defaultModelConfig')}
                hint={t('wizard.step1.selectProviderHint')}
                noProviderOption={t('wizard.alerts.noProviderOption')}
                defaultProviderText={t('wizard.defaults.provider')}
              />

              {/* Template Selection */}
              <Step1TemplateSelection
                activeTab={activeTab}
                useCustomTemplate={useCustomTemplate}
                selectedTemplateId={selectedTemplateId}
                savedTemplates={savedTemplates}
                genericTemplate={genericTemplate}
                onTabChange={setActiveTab}
                onTemplateSelect={setSelectedTemplateId}
                onUseCustomTemplate={() => setUseCustomTemplate(true)}
                onDeleteTemplate={handleDeleteTemplate}
                t={t}
              />

              {/* Basic Info */}
              <Step1BasicInfo
                name={name}
                onNameChange={setName}
                placeholder={t('wizard.placeholders.experimentName')}
                labelText={t('wizard.step1.experimentName')}
              />

              {/* Time Configuration */}
              <Step1TimeConfiguration
                baseTime={baseTime}
                timeUnit={timeUnit}
                timeStep={timeStep}
                onBaseTimeChange={setBaseTime}
                onTimeUnitChange={setTimeUnit}
                onTimeStepChange={setTimeStep}
                t={t}
              />

              {/* Custom Template Builder - Expanded View */}
              {useCustomTemplate && (
                <div className="border border-purple-200 rounded-lg overflow-hidden">
                  <div className="bg-purple-100 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-purple-900">{t('wizard.step1.customTemplateConfig')}</span>
                    <button
                      onClick={() => setUseCustomTemplate(false)}
                      className="text-xs text-purple-700 hover:text-purple-900"
                    >
                      {t('wizard.step1.collapse')}
                    </button>
                  </div>
                  <div className="p-4 bg-white max-h-[400px] overflow-y-auto">
                    <TemplateBuilder
                      template={genericTemplate}
                      onChange={setGenericTemplate}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6 h-full flex flex-col">
              {/* Provider Selector */}
              <ProviderSelector
                providers={llmProviders}
                selectedProviderId={selectedProviderId}
                onProviderChange={setSelectedProvider}
                title={t('wizard.step2.defaultModelConfig')}
                hint={t('wizard.step2.selectModelForAgents')}
                noProviderOption={t('wizard.alerts.noProviderOption')}
                defaultProviderText={t('wizard.defaults.provider')}
              />

              {/* Import Mode Selector */}
              <Step2ImportModeSelector
                importMode={importMode}
                onModeChange={(mode) => setImportMode(mode)}
                defaultText={t('wizard.methods.useTemplateAgents')}
                generateText={t('wizard.methods.aiBatchGenerate')}
                customText={t('wizard.methods.fileImport')}
              />

              {/* MODE: DEFAULT */}
              {importMode === 'default' && (
                <Step2DefaultMode template={selectedTemplate} t={t} />
              )}

              {/* MODE: AI GENERATE */}
              {importMode === 'generate' && (
                <div className="flex-1 flex flex-col gap-4">
                  <div className={`text-xs p-3 rounded border ${
                    visionCapable
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}>
                    {visionCapable
                      ? t('wizard.step2.visionSupported')
                      : t('wizard.step2.visionNotSupported')}
                  </div>

                  {/* Demographics Mode Toggle */}
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useDemographics}
                        onChange={(e) => setUseDemographics(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-bold text-blue-900">{t('wizard.step2.useDemographicsMode')}</span>
                    </label>
                    <span className="text-xs text-blue-700">{t('wizard.step2.demographicsHint')}</span>
                  </div>

                  {!useDemographics ? (
                    // Simple Description Mode
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-purple-50 border border-purple-100 p-4 rounded-lg">
                        <div className="col-span-1">
                          <label className="block text-xs font-bold text-purple-800 mb-2">
                            {t('wizard.step2.generateCount')}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={genCount}
                            onChange={(e) => setGenCount(Math.min(50, Math.max(1, parseInt(e.target.value))))}
                            className="w-full px-3 py-2 border border-purple-200 rounded text-sm focus:ring-purple-500"
                          />
                        </div>
                        <div className="col-span-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-bold text-purple-800">
                              {t('wizard.step2.populationDescription')}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                ref={imageInputRef}
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  handleEmbedImage(file);
                                  if (imageInputRef.current) {
                                    imageInputRef.current.value = '';
                                  }
                                }}
                              />
                              <button
                                onClick={() => imageInputRef.current?.click()}
                                disabled={isEmbeddingImage}
                                className="text-[10px] px-2 py-1 border border-purple-200 rounded text-purple-700 bg-white hover:bg-purple-50 disabled:opacity-60"
                              >
                                {isEmbeddingImage ? t('wizard.step2.uploading') : t('wizard.step2.uploadImage')}
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={genDesc}
                            onChange={(e) => setGenDesc(e.target.value)}
                            className="w-full px-3 py-2 border border-purple-200 rounded text-sm focus:ring-purple-500 h-20 resize-none"
                            placeholder={t('wizard.step2.generatePlaceholder')}
                          />
                        </div>
                        <div className="col-span-4 flex justify-end">
                          <button
                            onClick={handleGenerateAgents}
                            disabled={isGenerating}
                            className="px-6 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
                          >
                            {isGenerating ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Sparkles size={16} />
                            )}
                            {t('wizard.step2.startGeneration')}
                          </button>
                        </div>
                      </div>

                      {importError && (
                        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                          {importError}
                        </div>
                      )}

                      {/* Preview for Generated Agents */}
                      {customAgents.length > 0 ? (
                        <Step2AgentsPreview
                          agents={customAgents}
                          onClear={() => setCustomAgents([])}
                          t={t}
                        />
                      ) : (
                        <div className="text-xs text-slate-500 text-center py-2">
                          {t('wizard.step2.noAgentsGenerated')}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Demographics Mode
                    <Step2DemographicsEditor
                      demographics={demographics}
                      archetypes={archetypes}
                      traits={traits}
                      useDemographics={useDemographics}
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
                      customAgents={customAgents}
                      setCustomAgents={setCustomAgents}
                      importError={importError}
                      t={t}
                    />
                  )}
                </div>
              )}

              {/* MODE: FILE IMPORT */}
              {importMode === 'custom' && (
                <Step2FileImport
                  fileInputRef={fileInputRef}
                  customAgents={customAgents}
                  importError={importError}
                  onFileUpload={handleFileUpload}
                  onClearAgents={() => setCustomAgents([])}
                  t={t}
                />
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <Step3Confirmation
              useCustomTemplate={useCustomTemplate}
              genericTemplate={genericTemplate}
              selectedTemplate={selectedTemplate}
              customAgents={customAgents}
              timeUnit={timeUnit}
              timeStep={timeStep}
              t={t}
            />
          )}
        </div>

        {/* Footer */}
        <WizardFooter
          step={step}
          onCancel={() => toggleWizard(false)}
          onNext={handleNext}
          onPrevious={() => setStep(step - 1)}
          onFinish={handleFinish}
          isSaving={isGeneratingGlobal}
          cancelText={t('wizard.footer.cancel')}
          previousText={t('wizard.footer.previous')}
          nextText={t('wizard.footer.next')}
          finishText={t('wizard.footer.startSimulation')}
          savingText={t('wizard.footer.saving')}
        />
      </div>
    </div>
  );
};

// =============================================================================
// Step 2 Sub-components (defined inline for now, could be extracted)
// =============================================================================

interface Step2DemographicsEditorProps {
  demographics: Demographic[];
  archetypes: Archetype[];
  traits: TraitConfig[];
  useDemographics: boolean;
  genCount: number;
  isGenerating: boolean;
  onAddDemographic: () => void;
  onRemoveDemographic: (id: string) => void;
  onUpdateDemographicName: (id: string, name: string) => void;
  onUpdateDemographicCategories: (id: string, categories: string) => void;
  onUpdateCategoryName: (demoId: string, catIndex: number, value: string) => void;
  onAddCategory: (demoId: string) => void;
  onRemoveCategory: (demoId: string, catIndex: number) => void;
  onUpdateArchetypeProbability: (archId: string, newProb: number) => void;
  onNormalizeProbabilities: () => void;
  onAddTrait: () => void;
  onRemoveTrait: (id: string) => void;
  onUpdateTrait: (id: string, field: keyof TraitConfig, value: string | number) => void;
  onSetGenCount: (count: number) => void;
  onGenerateAgents: () => void;
  customAgents: Agent[];
  setCustomAgents: (agents: Agent[]) => void;
  importError: string | null;
  t: (key: string) => string;
}

const Step2DemographicsEditor: React.FC<Step2DemographicsEditorProps> = ({
  demographics,
  archetypes,
  traits,
  genCount,
  isGenerating,
  onAddDemographic,
  onRemoveDemographic,
  onUpdateDemographicName,
  onUpdateDemographicCategories,
  onUpdateCategoryName,
  onAddCategory,
  onRemoveCategory,
  onUpdateArchetypeProbability,
  onNormalizeProbabilities,
  onAddTrait,
  onRemoveTrait,
  onUpdateTrait,
  onSetGenCount,
  onGenerateAgents,
  customAgents,
  setCustomAgents,
  importError,
  t,
}) => {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
      {/* Demographics Configuration */}
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-800">{t('wizard.step2.demographics')}</h4>
          <button
            onClick={onAddDemographic}
            className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
          >
            <Plus size={14} /> {t('wizard.step2.addDimension')}
          </button>
        </div>
        <div className="space-y-3">
          {demographics.map((demo, demoIdx) => (
            <div key={demo.id} className="border border-slate-200 rounded p-3 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={demo.name}
                  onChange={(e) => onUpdateDemographicName(demo.id, e.target.value)}
                  placeholder={t('wizard.step2.dimensionNamePlaceholder')}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                />
                {demographics.length > 1 && (
                  <button
                    onClick={() => onRemoveDemographic(demo.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Minus size={16} />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">{t('wizard.step2.categoriesLabel')}</div>
                {demo.categories.map((cat, catIdx) => (
                  <div key={catIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cat}
                      onChange={(e) => onUpdateCategoryName(demo.id, catIdx, e.target.value)}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                    />
                    {demo.categories.length > 1 && (
                      <button
                        onClick={() => onRemoveCategory(demo.id, catIdx)}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => onAddCategory(demo.id)}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded flex items-center gap-1"
                >
                  <Plus size={12} /> {t('wizard.step2.addCategory')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Archetypes Preview */}
      {archetypes.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800">{t('wizard.step2.archetypes', { count: archetypes.length })}</h4>
              <span className="text-xs text-slate-500">{t('wizard.step2.archetypesHint')}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">{t('wizard.step2.totalProbability')}: <span className={Math.abs(archetypes.reduce((sum, a) => sum + a.probability, 0) - 1.0) < 0.01 ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>{archetypes.reduce((sum, a) => sum + a.probability, 0).toFixed(2)}</span> {t('wizard.step2.shouldBeOne')}</div>
              <button
                onClick={onNormalizeProbabilities}
                className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded mt-1"
              >
                {t('wizard.step2.normalizeAll')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {archetypes.map((arch) => (
              <div key={arch.id} className="p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                <div className="font-medium text-slate-700 truncate mb-1" title={arch.label}>{arch.label}</div>
                <div className="flex items-center gap-2">
                  <label className="text-slate-500">{t('wizard.step2.probability')}:</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={arch.probability.toFixed(2)}
                    onChange={(e) => onUpdateArchetypeProbability(arch.id, parseFloat(e.target.value) || 0)}
                    className="flex-1 px-1 py-0.5 border border-slate-300 rounded text-xs text-right"
                  />
                  <span className="text-slate-500">({(arch.probability * 100).toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">{t('wizard.step2.modifyProbabilityHint')}</p>
        </div>
      )}

      {/* Traits Configuration */}
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-800">{t('wizard.step2.traits')}</h4>
          <button
            onClick={onAddTrait}
            className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
          >
            <Plus size={14} /> {t('wizard.step2.addTrait')}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {traits.map((trait) => (
            <div key={trait.id} className="border border-slate-200 rounded p-2 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={trait.name}
                  onChange={(e) => onUpdateTrait(trait.id, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm font-medium"
                />
                {traits.length > 1 && (
                  <button
                    onClick={() => onRemoveTrait(trait.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Minus size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">{t('wizard.step2.mean')}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={trait.mean}
                    onChange={(e) => onUpdateTrait(trait.id, 'mean', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">{t('wizard.step2.std')}</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={trait.std}
                    onChange={(e) => onUpdateTrait(trait.id, 'std', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">{t('wizard.step2.traitsHint')}</p>
      </div>

      {/* Generation Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div>
          <label className="block text-xs font-bold text-blue-800 mb-2">
            {t('wizard.step2.generateCount')}
          </label>
          <input
            type="number"
            min="1"
            value={genCount}
            onChange={(e) => onSetGenCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 border border-blue-200 rounded text-sm focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={onGenerateAgents}
            disabled={isGenerating}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {t('wizard.step2.startGeneration')}
          </button>
        </div>
      </div>

      {importError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {importError}
        </div>
      )}

      {/* Preview for Generated Agents */}
      {customAgents.length > 0 ? (
        <Step2AgentsPreview
          agents={customAgents}
          onClear={() => setCustomAgents([])}
          t={t}
        />
      ) : (
        <div className="text-xs text-slate-500 text-center py-2">
          {t('wizard.step2.noAgentsGenerated')}
        </div>
      )}
    </div>
  );
};

interface Step2FileImportProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  customAgents: Agent[];
  importError: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAgents: () => void;
  t: (key: string) => string;
}

const Step2FileImport: React.FC<Step2FileImportProps> = ({
  fileInputRef,
  customAgents,
  importError,
  onFileUpload,
  onClearAgents,
  t,
}) => {
  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="shrink-0" onClick={() => fileInputRef.current?.click()}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          accept=".json,.csv"
          className="hidden"
        />
        <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50 rounded-lg p-6 text-center cursor-pointer transition-colors group">
          <Upload className="mx-auto text-slate-400 group-hover:text-brand-500 mb-2" size={32} />
          <p className="text-sm font-bold text-slate-700 group-hover:text-brand-600">
            {t('wizard.step2.uploadCsvJson')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {t('wizard.step2.requiredFields')}
          </p>
        </div>
      </div>
      {importError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {importError}
        </div>
      )}
      {customAgents.length > 0 && (
        <Step2AgentsPreview
          agents={customAgents}
          onClear={onClearAgents}
          t={t}
        />
      )}
    </div>
  );
};

interface Step2AgentsPreviewProps {
  agents: Agent[];
  onClear: () => void;
  t: (key: string, params?: any) => string;
}

const Step2AgentsPreview: React.FC<Step2AgentsPreviewProps> = ({ agents, onClear, t }) => {
  return (
    <div className="flex-1 border rounded-lg overflow-hidden flex flex-col bg-white">
      <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
        <span className="text-xs font-bold text-slate-700">
          {t('wizard.step2.generatedAgents', { count: agents.length })}
        </span>
        <button onClick={onClear} className="text-xs text-red-500 hover:underline">
          {t('wizard.step2.clearReset')}
        </button>
      </div>
      <div className="overflow-y-auto flex-1 p-0">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 sticky top-0 text-slate-500">
            <tr>
              <th className="px-4 py-2">{t('wizard.step2.name')}</th>
              <th className="px-4 py-2">{t('wizard.step2.role')}</th>
              <th className="px-4 py-2">{t('wizard.step2.description')}</th>
              <th className="px-4 py-2">{t('wizard.step2.attributes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {agents.map((a, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-bold">{a.name}</td>
                <td className="px-4 py-2">{a.role}</td>
                <td className="px-4 py-2 max-w-xs truncate" title={a.profile}>{a.profile}</td>
                <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{JSON.stringify(a.properties)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

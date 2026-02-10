// frontend/pages/SimulationWizard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useSimulationStore,
  generateAgentsWithAI,
  generateAgentsWithDemographics
} from '../store';
import {
  X,
  Check,
  Upload,
  Trash2,
  Users,
  Bot,
  Clock,
  LayoutTemplate,
  Sparkles,
  Loader2,
  Plus,
  Minus,
  Settings
} from 'lucide-react';
import Papa from 'papaparse';
import { Agent, LLMConfig, TimeUnit, GenericTemplateConfig } from '../types';
import { uploadImage } from '../services/uploads';
import { TemplateBuilder, createEmptyGenericTemplate } from './TemplateBuilder';

const TIME_UNITS = (t: (key: string) => string): { value: TimeUnit; label: string }[] => [
  { value: 'minute', label: t('wizard.timeUnits.minute') },
  { value: 'hour', label: t('wizard.timeUnits.hour') },
  { value: 'day', label: t('wizard.timeUnits.day') },
  { value: 'week', label: t('wizard.timeUnits.week') },
  { value: 'month', label: t('wizard.timeUnits.month') },
  { value: 'year', label: t('wizard.timeUnits.year') }
];

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

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>('village');
  const [activeTab, setActiveTab] = useState<'system' | 'custom'>('system');

  // Custom Template Mode
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [genericTemplate, setGenericTemplate] = useState<GenericTemplateConfig>(createEmptyGenericTemplate());

  const [baseTime, setBaseTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('hour');
  const [timeStep, setTimeStep] = useState(1);

  const [importMode, setImportMode] =
    useState<'default' | 'custom' | 'generate'>('default');
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

  // 打开向导时加载 provider 列表
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

  // 根据模板自动调整生成描述和数量
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

  const selectedTemplate =
    savedTemplates.find((t) => t.id === selectedTemplateId) ||
    savedTemplates[0];

  // 根据 provider 列表推导一个默认 LLMConfig（标记在 agent 上）
  const selectedProvider =
    llmProviders.find((p) => p.id === selectedProviderId) ||
    llmProviders.find((p) => (p as any).is_active || (p as any).is_default) ||
    llmProviders[0];

  const defaultLlmConfig: LLMConfig = selectedProvider
    ? {
        provider:
          (selectedProvider as any).name ||
          (selectedProvider as any).provider ||
          'backend',
        model: (selectedProvider as any).model || 'default'
      }
    : {
        provider: 'backend',
        model: 'default'
      };

  const visionCapable = !!(
    (selectedProvider as any)?.model &&
    /vision|gpt-4o|4o-mini|o1|gemini-pro-vision|gemini 1\.5|flash|pro|llava|llama-?3\.2|qwen2-vl/i.test((selectedProvider as any).model)
  );

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

  if (!isOpen) return null;

  const handleFinish = () => {
    const defaultConfig = defaultLlmConfig;
    const agentsToUse =
      importMode === 'custom' || importMode === 'generate'
        ? customAgents
        : undefined;

    if (agentsToUse) {
      agentsToUse.forEach((a) => {
        if (!a.llmConfig) {
          a.llmConfig = defaultConfig;
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
          sceneType: 'generic', // Indicates generic template
          agents: agentsToUse || [],
          defaultTimeConfig: genericTemplate.defaultTimeConfig || {
            baseTime: new Date(baseTime).toISOString(),
            unit: timeUnit,
            step: timeStep
          },
          // Store generic template data for backend processing
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
          const firstRow = (rows[0] || []).map((v: any) =>
            String(v ?? '').trim()
          );
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
            'agent_name',
            'agent_description',
            'name',
            'profile',
            'id',
            'role',
            'avatarUrl',
            'properties',
            'history',
            'memory',
            'knowledgeBase',
            'llmConfig'
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
            avatarUrl:
              row.avatarUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
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
          const more =
            errors.length > 5
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
      // Get current language from i18n (used by both modes)
      const currentLang = (i18n.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';

      let agents: Agent[];
      if (useDemographics) {
        // Use demographic-based generation
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
        // Use simple description-based generation
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
    // Auto-normalize: when one probability changes, adjust the others proportionally
    const oldProb = archetypes.find(a => a.id === archId)?.probability || 0;
    const currentTotal = archetypes.reduce((sum, a) => sum + a.probability, 0);
    const remainingTotal = currentTotal - oldProb;

    setArchetypes(archetypes.map(a => {
      if (a.id === archId) {
        return { ...a, probability: Math.max(0, Math.min(1, newProb)) };
      } else if (remainingTotal > 0) {
        // Scale other probabilities proportionally to maintain sum = 1
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

  // 点击"下一步"时的处理逻辑：如果没有任何可用模型，提醒一下
  const handleNext = () => {
    if (llmProviders.length === 0 || !selectedProviderId) {
      window.alert(`${t('wizard.alerts.noProviderTitle')}${t('wizard.alerts.noProviderMessage')}`);
      addNotification(
        'error',
        t('wizard.alerts.noProviderMessage')
      );
      // 这里选择"提示但仍然允许继续下一步"；如果你想阻止继续，可以直接 return;
      // return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {t('wizard.titles.createSimulation')}
            </h2>
            <div className="flex gap-2 mt-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full ${
                    step >= i ? 'bg-brand-500' : 'bg-slate-200'
                  }`}
                ></div>
              ))}
            </div>
          </div>
          <button
            onClick={() => toggleWizard(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-8 max-w-3xl mx-auto">
              {/* 默认模型配置：使用设置里的 provider */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded text-indigo-600">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-900">
                      {t('wizard.step1.defaultModelConfig')}
                    </h3>
                    <p className="text-xs text-indigo-700">
                      {t('wizard.step1.selectProviderHint')}
                    </p>
                  </div>
                </div>

                <select
                  value={selectedProviderId ?? ''}
                  onChange={(e) =>
                    setSelectedProvider(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="text-xs border-indigo-200 rounded px-2 py-1.5 focus:ring-indigo-500 min-w-[260px]"
                >
                  {llmProviders.length === 0 && (
                    <option value="">
                      {t('wizard.alerts.noProviderOption')}
                    </option>
                  )}
                  {llmProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {((p as any).name || (p as any).provider || t('wizard.defaults.provider')) +
                        ((p as any).model ? ` · ${(p as any).model}` : '') +
                        ((p as any).base_url ? ` · ${(p as any).base_url}` : '')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Selection #20 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <LayoutTemplate size={16} /> {t('wizard.step1.selectSceneTemplate')}
                </label>

                <div className="flex gap-4 border-b border-slate-200 mb-4">
                  <button
                    onClick={() => { setActiveTab('system'); setUseCustomTemplate(false); }}
                    className={`pb-2 text-sm font-medium transition-colors ${
                      activeTab === 'system' && !useCustomTemplate
                        ? 'text-brand-600 border-b-2 border-brand-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('wizard.step1.systemPresets')}
                  </button>
                  <button
                    onClick={() => { setActiveTab('custom'); setUseCustomTemplate(false); }}
                    className={`pb-2 text-sm font-medium transition-colors ${
                      activeTab === 'custom' && !useCustomTemplate
                        ? 'text-brand-600 border-b-2 border-brand-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('wizard.step1.myTemplates')}
                  </button>
                  <button
                    onClick={() => { setUseCustomTemplate(true); }}
                    className={`pb-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                      useCustomTemplate
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Settings size={14} />
                    {t('wizard.step1.customTemplateBuilder')}
                  </button>
                </div>

                {/* System/Custom Templates */}
                {!useCustomTemplate && (
                  <div className="grid grid-cols-3 gap-4">
                    {savedTemplates.filter((t) => t.category === activeTab)
                      .length === 0 ? (
                      <div className="col-span-3 py-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                        {activeTab === 'custom'
                          ? t('wizard.step1.noCustomTemplates')
                          : t('wizard.step1.noSystemTemplates')}
                      </div>
                    ) : (
                      savedTemplates
                        .filter((tpl) => tpl.category === activeTab)
                        .map((tpl) => (
                          <div
                            key={tpl.id}
                            onClick={() => setSelectedTemplateId(tpl.id)}
                            className={`p-4 border rounded-lg text-left transition-all cursor-pointer relative group ${
                              selectedTemplateId === tpl.id && !useCustomTemplate
                                ? 'border-brand-500 ring-2 ring-brand-100 bg-brand-50'
                                : 'hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-bold text-slate-800">
                              {tpl.category === 'system'
                                ? t(`systemTemplates.${tpl.id}.name`)
                                : tpl.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {tpl.category === 'system'
                                ? t(`systemTemplates.${tpl.id}.description`)
                                : tpl.description}
                            </div>

                            {tpl.category === 'custom' && (
                              <button
                                onClick={(e) => handleDeleteTemplate(e, tpl.id)}
                                className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}

                            {tpl.category === 'custom' && (
                              <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-600 bg-brand-100 px-1.5 py-0.5 rounded w-fit">
                                <Users size={10} /> {tpl.agents?.length || 0} {t('wizard.agents')}
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                )}

                {/* Custom Template Builder */}
                {useCustomTemplate && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Settings className="text-purple-600" size={18} />
                        <span className="text-sm font-bold text-purple-900">
                          {t('wizard.step1.customTemplateBuilderTitle')}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-purple-700 mb-3">
                      {t('wizard.step1.customTemplateBuilderDesc')}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white rounded p-2 text-center">
                        <div className="font-bold text-purple-700">{genericTemplate.coreMechanics.filter(m => m.enabled).length}</div>
                        <div className="text-slate-500">{t('wizard.step1.enabledMechanisms')}</div>
                      </div>
                      <div className="bg-white rounded p-2 text-center">
                        <div className="font-bold text-purple-700">{genericTemplate.availableActions.length}</div>
                        <div className="text-slate-500">{t('wizard.step1.availableActions')}</div>
                      </div>
                      <div className="bg-white rounded p-2 text-center">
                        <div className="font-bold text-purple-700">{(genericTemplate.environment.rules?.length || 0)}</div>
                        <div className="text-slate-500">{t('wizard.step1.environmentRules')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('wizard.step1.experimentName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('wizard.placeholders.experimentName')}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                />
              </div>

              {/* Time Configuration #9 */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5">
                <label className="block text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                  <Clock size={16} /> {t('wizard.step1.timeSettings')}
                </label>
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <span className="text-xs text-indigo-700 mb-1 block font-medium">
                      {t('wizard.step1.baseWorldTime')}
                    </span>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={baseTime}
                        onChange={(e) => setBaseTime(e.target.value)}
                        className="w-full px-3 py-2 border border-indigo-200 rounded text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-2 border border-indigo-200 rounded">
                    <span className="text-xs text-indigo-700 whitespace-nowrap">
                      {t('wizard.step1.advancePerTurn')}
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={timeStep}
                      onChange={(e) =>
                        setTimeStep(Math.max(1, parseInt(e.target.value)))
                      }
                      className="w-14 text-center border-b border-indigo-300 focus:border-indigo-600 outline-none text-sm font-bold"
                    />
                    <select
                      value={timeUnit}
                      onChange={(e) =>
                        setTimeUnit(e.target.value as TimeUnit)
                      }
                      className="text-sm bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer"
                    >
                      {TIME_UNITS(t).map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-indigo-600 mt-2">
                  {t('wizard.step1.currentSettingsPreview')}
                  {(() => {
                    const d = new Date(baseTime);
                    const msMap: any = {
                      minute: 60000,
                      hour: 3600000,
                      day: 86400000,
                      week: 604800000
                    };
                    if (msMap[timeUnit]) {
                      d.setTime(
                        d.getTime() + msMap[timeUnit] * timeStep * 10
                      );
                      return d.toLocaleString();
                    }
                    return t('wizard.step1.dynamicCalculation');
                  })()}
                </p>
              </div>

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

          {step === 2 && (
            <div className="space-y-6 h-full flex flex-col">
              {/* 默认模型配置：这里保留模型下拉框，使用 provider 列表 */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded text-indigo-600">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-900">
                      {t('wizard.step2.defaultModelConfig')}
                    </h3>
                    <p className="text-xs text-indigo-700">
                      {t('wizard.step2.selectModelForAgents')}
                    </p>
                  </div>
                </div>
                <select
                  value={selectedProviderId ?? ''}
                  onChange={(e) =>
                    setSelectedProvider(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="text-xs border-indigo-200 rounded px-2 py-1.5 focus:ring-indigo-500 min-w-[260px]"
                >
                  {llmProviders.length === 0 && (
                    <option value="">
                      {t('wizard.alerts.noProviderOption')}
                    </option>
                  )}
                  {llmProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {((p as any).name || (p as any).provider || t('wizard.defaults.provider')) +
                        ((p as any).model ? ` · ${(p as any).model}` : '') +
                        ((p as any).base_url ? ` · ${(p as any).base_url}` : '')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center mb-4">
                <div className="bg-slate-100 p-1 rounded-lg inline-flex">
                  <button
                    onClick={() => setImportMode('default')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      importMode === 'default'
                        ? 'bg-white shadow text-brand-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('wizard.methods.useTemplateAgents')}
                  </button>
                  <button
                    onClick={() => setImportMode('generate')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                      importMode === 'generate'
                        ? 'bg-white shadow text-purple-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Sparkles size={14} />
                    {t('wizard.methods.aiBatchGenerate')}
                  </button>
                  <button
                    onClick={() => setImportMode('custom')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      importMode === 'custom'
                        ? 'bg-white shadow text-brand-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('wizard.methods.fileImport')}
                  </button>
                </div>
              </div>

              {/* MODE: DEFAULT */}
              {importMode === 'default' && (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700">
                    {t('wizard.step2.usingPresetAgents')}{' '}
                    <span className="text-brand-600">
                      {selectedTemplate.category === 'system'
                        ? t(`systemTemplates.${selectedTemplate.id}.name`)
                        : selectedTemplate.name}
                    </span>{' '}
                    {t('wizard.step2.customTemplateAgents', { count: selectedTemplate.agents?.length || 0 })}
                  </h3>
                  <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">
                    {selectedTemplate.category === 'custom'
                      ? t('wizard.step2.customTemplateAgents', {
                          count: selectedTemplate.agents?.length || 0
                        })
                      : t('wizard.step2.systemTemplateAgents', {
                          count: selectedTemplate.sceneType === 'council'
                            ? 5
                            : selectedTemplate.sceneType === 'werewolf'
                            ? 9
                            : 2
                        })}
                  </p>
                </div>
              )}

              {/* MODE: AI GENERATE */}
              {importMode === 'generate' && (
                <div className="flex-1 flex flex-col gap-4">
                  <div className={`text-xs p-3 rounded border ${visionCapable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
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
                          onChange={(e) =>
                            setGenCount(
                              Math.min(
                                50,
                                Math.max(1, parseInt(e.target.value))
                              )
                            )
                          }
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
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Sparkles size={16} />
                          )}
                          {t('wizard.step2.startGeneration')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Demographics Mode
                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                      {/* Demographics Configuration */}
                      <div className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-slate-800">{t('wizard.step2.demographics')}</h4>
                          <button
                            onClick={handleAddDemographic}
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
                                  onChange={(e) => handleUpdateDemographicName(demo.id, e.target.value)}
                                  placeholder={t('wizard.step2.dimensionNamePlaceholder')}
                                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                                />
                                {demographics.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveDemographic(demo.id)}
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
                                      onChange={(e) => handleUpdateCategoryName(demo.id, catIdx, e.target.value)}
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                                    />
                                    {demo.categories.length > 1 && (
                                      <button
                                        onClick={() => handleRemoveCategory(demo.id, catIdx)}
                                        className="p-1 text-red-400 hover:text-red-600"
                                      >
                                        <Minus size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  onClick={() => handleAddCategory(demo.id)}
                                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded flex items-center gap-1"
                                >
                                  <Plus size={12} /> {t('wizard.step2.addCategory')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Generated Archetypes Preview with Inline Probability Editing */}
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
                                onClick={handleNormalizeProbabilities}
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
                                    onChange={(e) => handleUpdateArchetypeProbability(arch.id, parseFloat(e.target.value) || 0)}
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
                            onClick={handleAddTrait}
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
                                  onChange={(e) => handleUpdateTrait(trait.id, 'name', e.target.value)}
                                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm font-medium"
                                />
                                {traits.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveTrait(trait.id)}
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
                                    onChange={(e) => handleUpdateTrait(trait.id, 'mean', parseInt(e.target.value) || 0)}
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
                                    onChange={(e) => handleUpdateTrait(trait.id, 'std', parseInt(e.target.value) || 0)}
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
                            onChange={(e) => setGenCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-2 border border-blue-200 rounded text-sm focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={handleGenerateAgents}
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
                    </div>
                  )}

                  {importError && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                      {importError}
                    </div>
                  )}

                  {/* Preview for Generated Agents */}
                  {customAgents.length > 0 && (
                    <div className="flex-1 border rounded-lg overflow-hidden flex flex-col bg-white">
                      <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">
                          {t('wizard.step2.generatedAgents', { count: customAgents.length })}
                        </span>
                        <button
                          onClick={() => setCustomAgents([])}
                          className="text-xs text-red-500 hover:underline"
                        >
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
                            {customAgents.map((a, i) => (
                              <tr
                                key={i}
                                className="hover:bg-slate-50"
                              >
                                <td className="px-4 py-2 font-bold">
                                  {a.name}
                                </td>
                                <td className="px-4 py-2">
                                  {a.role}
                                </td>
                                <td
                                  className="px-4 py-2 max-w-xs truncate"
                                  title={a.profile}
                                >
                                  {a.profile}
                                </td>
                                <td className="px-4 py-2 font-mono text-[10px] text-slate-500">
                                  {JSON.stringify(a.properties)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE: FILE IMPORT */}
              {importMode === 'custom' && (
                <div className="flex-1 flex flex-col gap-4">
                  <div
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".json,.csv"
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50 rounded-lg p-6 text-center cursor-pointer transition-colors group">
                      <Upload
                        className="mx-auto text-slate-400 group-hover:text-brand-500 mb-2"
                        size={32}
                      />
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
                    <div className="flex-1 border rounded-lg overflow-hidden flex flex-col bg-white">
                      <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">
                          {t('wizard.step2.parsedAgents', { count: customAgents.length })}
                        </span>
                        <button
                          onClick={() => setCustomAgents([])}
                          className="text-xs text-red-500 hover:underline"
                        >
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
                            {customAgents.map((a, i) => (
                              <tr
                                key={i}
                                className="hover:bg-slate-50"
                              >
                                <td className="px-4 py-2 font-bold">
                                  {a.name}
                                </td>
                                <td className="px-4 py-2">
                                  {a.role}
                                </td>
                                <td
                                  className="px-4 py-2 max-w-xs truncate"
                                  title={a.profile}
                                >
                                  {a.profile}
                                </td>
                                <td className="px-4 py-2 font-mono text-[10px] text-slate-500">
                                  {JSON.stringify(a.properties)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center py-8">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                {t('wizard.step3.ready')}
              </h3>
              <div className="bg-slate-50 rounded-lg p-6 max-w-md mx-auto text-left space-y-3 border">
                {useCustomTemplate ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('wizard.step3.templateType')}:</span>
                      <span className="font-bold text-purple-700">
                        {t('wizard.step3.customTemplate')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('wizard.step3.templateName')}:</span>
                      <span className="font-bold text-slate-800">
                        {genericTemplate.name || t('wizard.step3.unnamed')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('wizard.step3.coreMechanisms')}:</span>
                      <span className="font-bold text-slate-800">
                        {genericTemplate.coreMechanics.filter(m => m.enabled).map(m => m.type).join(', ') || t('wizard.step3.none')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('wizard.step3.availableActionsCount')}:</span>
                      <span className="font-bold text-slate-800">
                        {genericTemplate.availableActions.length} {t('wizard.step1.availableActions')}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('wizard.step3.template')}:</span>
                      <span className="font-bold text-slate-800">
                        {selectedTemplate.category === 'system'
                          ? t(`systemTemplates.${selectedTemplate.id}.name`)
                          : selectedTemplate.name}
                      </span>
                    </div>
                    {(importMode === 'custom' || importMode === 'generate') &&
                      customAgents.length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{t('wizard.step3.customAgents')}:</span>
                          <span className="font-bold text-brand-600">
                            {customAgents.length} {t('wizard.step3.people')}
                          </span>
                        </div>
                      )}
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('wizard.step3.timeFlow')}:</span>
                  <span className="font-bold text-slate-800">
                    {t('wizard.step3.perTurn')} {timeStep}{' '}
                    {
                      TIME_UNITS(t).find((u) => u.value === timeUnit)
                        ?.label
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
            >
              {t('wizard.footer.previous')}
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => toggleWizard(false)}
              className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
            >
              {t('wizard.footer.cancel')}
            </button>
          )}
          {step < 3 && (
            <button
              onClick={handleNext}
              className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm"
            >
              {t('wizard.footer.next')}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleFinish}
              className="px-6 py-2 text-sm bg-green-600 text-white font-medium hover:bg-green-700 rounded-lg shadow-sm"
              disabled={isGeneratingGlobal}
            >
              {isGeneratingGlobal ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> {t('wizard.footer.saving')}
                </span>
              ) : (
                t('wizard.footer.startSimulation')
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

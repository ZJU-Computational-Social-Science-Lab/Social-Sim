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
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';
import { Agent, LLMConfig, TimeUnit } from '../types';
import { DemographicsBuilder } from '../components/DemographicsBuilder';

export const SimulationWizard: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useSimulationStore((state) => state.isWizardOpen);
  const toggleWizard = useSimulationStore((state) => state.toggleWizard);
  const addSimulation = useSimulationStore((state) => state.addSimulation);
  const savedTemplates = useSimulationStore((state) => state.savedTemplates);
  const deleteTemplate = useSimulationStore((state) => state.deleteTemplate);
  const addNotification = useSimulationStore((state) => state.addNotification);

  // Time units with i18n labels
  const TIME_UNITS: { value: TimeUnit; label: string }[] = [
    { value: 'minute', label: t('wizard.timeUnits.minute') },
    { value: 'hour', label: t('wizard.timeUnits.hour') },
    { value: 'day', label: t('wizard.timeUnits.day') },
    { value: 'week', label: t('wizard.timeUnits.week') },
    { value: 'month', label: t('wizard.timeUnits.month') },
    { value: 'year', label: t('wizard.timeUnits.year') }
  ];

  // ⭐ 新增：连接到 store 里的 provider 列表
  const llmProviders = useSimulationStore((s) => s.llmProviders);
  const selectedProviderId = useSimulationStore((s) => s.selectedProviderId);
  const setSelectedProvider = useSimulationStore((s) => s.setSelectedProvider);
  const loadProviders = useSimulationStore((s) => s.loadProviders);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>('village');
  const [activeTab, setActiveTab] = useState<'system' | 'custom'>('system');

  const [baseTime, setBaseTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('hour');
  const [timeStep, setTimeStep] = useState(1);

  const [importMode, setImportMode] =
    useState<'default' | 'custom' | 'generate' | 'demographics'>('demographics');
  const [customAgents, setCustomAgents] = useState<Agent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Demographics state
  const [demoTotalAgents, setDemoTotalAgents] = useState(50);
  const [demographics, setDemographics] = useState<Array<{name: string, categories: string[]}>>([]);
  const [traits, setTraits] = useState<Array<{name: string, mean: number, std: number}>>([]);

  const [genCount, setGenCount] = useState(5);
  const [genDesc, setGenDesc] = useState(
    t('wizard.defaultPrompts.village')
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开向导时加载 provider 列表
  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen, loadProviders]);

  useEffect(() => {
    const defaults: Record<string, string> = {
      village: t('wizard.defaultPrompts.village'),
      council: t('wizard.defaultPrompts.council'),
      werewolf: t('wizard.defaultPrompts.werewolf')
    };
    setGenDesc(defaults[selectedTemplateId] || defaults['village']);
    const counts: Record<string, number> = {
      village: 5,
      council: 5,
      werewolf: 9
    };
    setGenCount(counts[selectedTemplateId] ?? 5);
  }, [selectedTemplateId, t]);

  const selectedTemplate =
    savedTemplates.find((t) => t.id === selectedTemplateId) ||
    savedTemplates[0];

  // 根据 provider 列表推导出一个默认 LLMConfig（只用来标记 agent 上的配置）
  const selectedProvider =
    llmProviders.find((p) => p.id === selectedProviderId) ||
    llmProviders.find((p) => (p as any).is_active || (p as any).is_default) ||
    llmProviders[0];

  const defaultLlmConfig: LLMConfig = selectedProvider
    ? {
        provider:
          selectedProvider.name ||
          selectedProvider.provider ||
          'backend',
        model: selectedProvider.model || 'default'
      }
    : {
        provider: 'backend',
        model: 'default'
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

    addSimulation(name, selectedTemplate, agentsToUse, {
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
    setGenDesc(t('wizard.defaultPrompts.village'));
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
        let rawAgents: any[] = [];
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          rawAgents = Array.isArray(data) ? data : data.agents;
        } else if (file.name.endsWith('.csv')) {
          const result = Papa.parse(text, {
            header: true,
            skipEmptyLines: true
          });
          rawAgents = result.data;
        }
        const agents: Agent[] = rawAgents.map((row: any, index) => ({
          id: row.id || `imported_${Date.now()}_${index}`,
          name: row.name,
          role: row.role || 'Citizen',
          avatarUrl:
            row.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.name}`,
          profile: row.profile || t('wizard.noDescription'),
          properties: row.properties || {},
          history: row.history || {},
          memory: row.memory || [],
          knowledgeBase: row.knowledgeBase || [],
          llmConfig: row.llmConfig || currentConfig
        }));
        setCustomAgents(agents);
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
      const agents = await generateAgentsWithAI(
        genCount,
        genDesc,
        selectedProviderId ?? undefined
      );
      agents.forEach((a) => {
        a.llmConfig = defaultLlmConfig;
      });
      setCustomAgents(agents);
      addNotification('success', t('wizard.messages.generatedAgents', { count: agents.length }));
    } catch (e) {
      console.error(e);
      setImportError(t('wizard.messages.generationFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDemographics = async () => {
    setIsGenerating(true);
    setImportError(null);
    try {
      // Build archetype probabilities from demographics
      const archetypeProbs: Record<string, number> = {};
      demographics.forEach(d => {
        d.categories.forEach(c => {
          archetypeProbs[`${d.name}:${c}`] = 1 / d.categories.length;
        });
      });

      const agents = await generateAgentsWithDemographics(
        demoTotalAgents,
        demographics,
        archetypeProbs,
        traits,
        'en',
        selectedProviderId ?? undefined
      );
      agents.forEach((a) => {
        a.llmConfig = defaultLlmConfig;
      });
      setCustomAgents(agents);
      addNotification('success', t('wizard.messages.generatedAgents', { count: agents.length }));
    } catch (e) {
      console.error(e);
      setImportError(t('wizard.messages.generationFailed'));
    } finally {
      setIsGenerating(false);
    }
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
                      {t('wizard.titles.defaultModelConfig')}
                    </h3>
                    <p className="text-xs text-indigo-700">
                      {t('wizard.instructions.selectProvider')}
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
                      {t('wizard.instructions.noProviderConfigured')}
                    </option>
                  )}
                  {llmProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.name || p.provider || 'Provider') +
                        (p.model ? ` · ${p.model}` : '') +
                        (p.base_url ? ` · ${p.base_url}` : '')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Selection */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {t('wizard.titles.templateSelection', { defaultValue: 'Select Template' })}
                </h3>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="village">Village</option>
                  <option value="council">Council</option>
                  <option value="werewolf">Werewolf</option>
                </select>
              </div>

              {/* Simulation Name */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {t('wizard.simulationName', { defaultValue: 'Simulation Name' })}
                </h3>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('wizard.placeholders.simulationName')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Time Configuration */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {t('wizard.timeConfig', { defaultValue: 'Time Configuration' })}
                </h3>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-600">Start Time</label>
                    <input
                      type="datetime-local"
                      value={baseTime}
                      onChange={(e) => setBaseTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-600">Unit</label>
                    <select
                      value={timeUnit}
                      onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      {TIME_UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-slate-600">Step</label>
                    <input
                      type="number"
                      min="1"
                      value={timeStep}
                      onChange={(e) => setTimeStep(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Agent Generation Method Selection */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {t('wizard.titles.agentGeneration', { defaultValue: 'Agent Generation Method' })}
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setImportMode('demographics')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      importMode === 'demographics'
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t('wizard.methods.demographics')}
                  </button>
                  <button
                    onClick={() => setImportMode('generate')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      importMode === 'generate'
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t('wizard.methods.generate')}
                  </button>
                  <button
                    onClick={() => setImportMode('custom')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      importMode === 'custom'
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t('wizard.methods.custom')}
                  </button>
                  <button
                    onClick={() => setImportMode('default')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      importMode === 'default'
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t('wizard.methods.default')}
                  </button>
                </div>
              </div>

              {/* Demographics Mode */}
              {importMode === 'demographics' && (
                <DemographicsBuilder
                  totalAgents={demoTotalAgents}
                  setTotalAgents={setDemoTotalAgents}
                  demographics={demographics}
                  setDemographics={setDemographics}
                  traits={traits}
                  setTraits={setTraits}
                  onGenerate={handleGenerateDemographics}
                  isGenerating={isGenerating}
                />
              )}

              {/* Simple Generate Mode */}
              {importMode === 'generate' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t('wizard.agentCount', { defaultValue: 'Number of Agents' })}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={genCount}
                      onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t('wizard.agentDescription', { defaultValue: 'Description' })}
                    </label>
                    <textarea
                      value={genDesc}
                      onChange={(e) => setGenDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      rows={3}
                    />
                  </div>
                  <button
                    onClick={handleGenerateAgents}
                    disabled={isGenerating}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300"
                  >
                    {isGenerating ? t('wizard.demographics.generating', { defaultValue: 'Generating...' }) : t('wizard.generate')}
                  </button>
                </div>
              )}

              {/* Custom Import Mode */}
              {importMode === 'custom' && (
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-brand-500 hover:bg-brand-50"
                  >
                    <Upload className="mx-auto mb-2" size={24} />
                    {t('wizard.uploadFile', { defaultValue: 'Click to upload CSV or JSON' })}
                  </button>
                  {importError && (
                    <p className="text-red-500 text-sm">{importError}</p>
                  )}
                  {customAgents.length > 0 && (
                    <p className="text-sm text-slate-600">
                      {customAgents.length} {t('wizard.agentsLoaded', { defaultValue: 'agents loaded' })}
                    </p>
                  )}
                </div>
              )}

              {/* Default Mode */}
              {importMode === 'default' && (
                <p className="text-slate-600 text-sm">
                  {t('wizard.defaultModeDescription', { defaultValue: 'Using template default agents. Click Next to continue.' })}
                </p>
              )}

              {importError && (
                <p className="text-red-500 text-sm">{importError}</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <h3 className="text-lg font-semibold">
                {t('wizard.titles.reviewAndStart', { defaultValue: 'Review and Start' })}
              </h3>
              <div className="bg-slate-50 rounded-lg p-4">
                <p><strong>Name:</strong> {name || t('wizard.untitled', { defaultValue: 'Untitled' })}</p>
                <p><strong>Template:</strong> {selectedTemplateId}</p>
                <p><strong>Agents:</strong> {customAgents.length || t('wizard.usingDefaults', { defaultValue: 'Using defaults' })}</p>
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
              {t('wizard.back')}
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => toggleWizard(false)}
              className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm"
            >
              {t('wizard.continue')}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleFinish}
              className="px-6 py-2 text-sm bg-green-600 text-white font-medium hover:bg-green-700 rounded-lg shadow-sm"
            >
              {t('wizard.start')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

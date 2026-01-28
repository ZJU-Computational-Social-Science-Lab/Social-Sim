// frontend/pages/SimulationWizard.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  useSimulationStore,
  generateAgentsWithAI
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

const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' },
  { value: 'day', label: '天' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' }
];

export const SimulationWizard: React.FC = () => {
  const isOpen = useSimulationStore((state) => state.isWizardOpen);
  const toggleWizard = useSimulationStore((state) => state.toggleWizard);
  const addSimulation = useSimulationStore((state) => state.addSimulation);
  const savedTemplates = useSimulationStore((state) => state.savedTemplates);
  const deleteTemplate = useSimulationStore((state) => state.deleteTemplate);
  const addNotification = useSimulationStore((state) => state.addNotification);
  const isGeneratingGlobal = useSimulationStore((s) => s.isGenerating);

  // ⭐ provider 相关
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
    useState<'default' | 'custom' | 'generate'>('default');
  const [customAgents, setCustomAgents] = useState<Agent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const [genCount, setGenCount] = useState(5);
  const [genDesc, setGenDesc] = useState(
    '创建一个多元化的乡村社区，包含务农者、商人和知识分子。'
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开向导时加载 provider 列表
  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen, loadProviders]);

  // 根据模板自动调整生成描述和数量
  useEffect(() => {
    const defaults: Record<string, string> = {
      village:
        '创建一个多元化的乡村社区，包含务农者、商人和知识分子。',
      council:
        '创建一个由5名成员组成的议会，每位成员具有不同政策立场与影响力。',
      werewolf:
        '创建一个狼人杀9人局的玩家群体画像：法官/上帝、预言家、女巫、猎人、2名狼人、3名平民，并描述性格与策略偏好。'
    };
    setGenDesc(defaults[selectedTemplateId] || defaults['village']);
    const counts: Record<string, number> = {
      village: 5,
      council: 5,
      werewolf: 9
    };
    setGenCount(counts[selectedTemplateId] ?? 5);
  }, [selectedTemplateId]);

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
    setGenDesc(
      '创建一个多元化的乡村社区，包含务农者、商人和知识分子。'
    );
  };

  const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个模板吗？')) {
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
            throw new Error('JSON 格式错误：应为数组或包含 agents 数组');
          }
          rawItems = items.map((row, index) => ({
            row,
            label: `第 ${index + 1} 项`
          }));
        } else if (file.name.endsWith('.csv')) {
          const result = Papa.parse(text, {
            header: false,
            skipEmptyLines: true
          });
          if (result.errors.length > 0) {
            throw new Error(
              `CSV 解析失败：${result.errors[0].message || '格式错误'}`
            );
          }
          const rows = result.data as any[];
          if (!rows || rows.length === 0) {
            throw new Error('CSV 为空或没有有效数据行');
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
            throw new Error('CSV 为空或没有有效数据行');
          }
          rawItems = dataRows.map((row: any, index: number) => {
            const values = Array.isArray(row) ? row : Object.values(row);
            if (header) {
              const obj: Record<string, any> = {};
              header.forEach((key, i) => {
                if (key) obj[key] = values[i];
              });
              return { row: obj, label: `第 ${index + 2} 行` };
            }
            const obj: Record<string, any> = {
              agent_name: values[0],
              agent_description: values[1]
            };
            values.slice(2).forEach((val, i) => {
              obj[`attribute${i + 1}`] = val;
            });
            return { row: obj, label: `第 ${index + 1} 行` };
          });
        } else {
          throw new Error('仅支持 .json 或 .csv 文件');
        }
        const errors: string[] = [];
        const agents: Agent[] = [];
        rawItems.forEach(({ row, label }, index) => {
          if (!row || typeof row !== 'object') {
            errors.push(`${label}：数据格式错误`);
            return;
          }
          const name = row.agent_name ?? row.name;
          const profile = row.agent_description ?? row.profile;
          if (!name || !profile) {
            errors.push(`${label}：缺少 agent_name 或 agent_description`);
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
            role: row.role || 'Citizen',
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
              ? `；另有 ${errors.length - 5} 条错误`
              : '';
          setImportError(
            `已导入 ${agents.length} 个，以下 ${errors.length} 个无效：${detail}${more}`
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
      const agents = await generateAgentsWithAI(
        genCount,
        genDesc,
        selectedProviderId ?? undefined
      );
      agents.forEach((a) => {
        a.llmConfig = defaultLlmConfig;
      });
      setCustomAgents(agents);
      addNotification('success', `成功生成 ${agents.length} 个智能体`);
    } catch (e) {
      console.error(e);
      setImportError('生成失败，请检查 API Key 或重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 点击“下一步”时的处理逻辑：如果没有任何可用模型，提醒一下
  const handleNext = () => {
    if (llmProviders.length === 0 || !selectedProviderId) {
      window.alert('没有可用模型，请先在“设置 → LLM 提供商”中添加。');
      addNotification(
        'error',
        '没有可用模型，请先在“设置 → LLM 提供商”中添加。'
      );
      // 这里选择“提示但仍然允许继续下一步”；如果你想阻止继续，可以直接 return;
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
              创建新仿真
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
                      默认模型配置
                    </h3>
                    <p className="text-xs text-indigo-700">
                      从「设置 → LLM提供商」中选择一个已配置的模型。
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
                      尚未配置任何提供商（请先在“设置”中添加）
                    </option>
                  )}
                  {llmProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {((p as any).name || (p as any).provider || 'Provider') +
                        ((p as any).model ? ` · ${(p as any).model}` : '') +
                        ((p as any).base_url ? ` · ${(p as any).base_url}` : '')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Selection #20 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <LayoutTemplate size={16} /> 1. 选择场景模板
                </label>

                <div className="flex gap-4 border-b border-slate-200 mb-4">
                  <button
                    onClick={() => setActiveTab('system')}
                    className={`pb-2 text-sm font-medium transition-colors ${
                      activeTab === 'system'
                        ? 'text-brand-600 border-b-2 border-brand-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    系统预设
                  </button>
                  <button
                    onClick={() => setActiveTab('custom')}
                    className={`pb-2 text-sm font-medium transition-colors ${
                      activeTab === 'custom'
                        ? 'text-brand-600 border-b-2 border-brand-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    我的模板库
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {savedTemplates.filter((t) => t.category === activeTab)
                    .length === 0 ? (
                    <div className="col-span-3 py-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                      暂无自定义模板。请先配置一个仿真并保存为模板。
                    </div>
                  ) : (
                    savedTemplates
                      .filter((t) => t.category === activeTab)
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTemplateId(t.id)}
                          className={`p-4 border rounded-lg text-left transition-all cursor-pointer relative group ${
                            selectedTemplateId === t.id
                              ? 'border-brand-500 ring-2 ring-brand-100 bg-brand-50'
                              : 'hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold text-slate-800">
                            {t.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {t.description}
                          </div>

                          {t.category === 'custom' && (
                            <button
                              onClick={(e) => handleDeleteTemplate(e, t.id)}
                              className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          {t.category === 'custom' && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-600 bg-brand-100 px-1.5 py-0.5 rounded w-fit">
                              <Users size={10} /> {t.agents?.length || 0} 个预设角色
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  2. 实验名称 (可选)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：乡村信任度测试 A组"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                />
              </div>

              {/* Time Configuration #9 */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5">
                <label className="block text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                  <Clock size={16} /> 3. 仿真时间设置 (Time Scale)
                </label>
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <span className="text-xs text-indigo-700 mb-1 block font-medium">
                      起始世界时间
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
                      每回合推进:
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
                      {TIME_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-indigo-600 mt-2">
                  当前设置下，第 10 回合将对应:{' '}
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
                    return '根据单位动态计算';
                  })()}
                </p>
              </div>
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
                      默认模型配置
                    </h3>
                    <p className="text-xs text-indigo-700">
                      选择一个用于新建智能体的模型（来自设置中的 LLM 提供商）。
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
                      尚未配置任何提供商（请先在“设置”中添加）
                    </option>
                  )}
                  {llmProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {((p as any).name || (p as any).provider || 'Provider') +
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
                    使用模板角色
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
                    AI 批量生成
                  </button>
                  <button
                    onClick={() => setImportMode('custom')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      importMode === 'custom'
                        ? 'bg-white shadow text-brand-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    文件导入
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
                    将使用{' '}
                    <span className="text-brand-600">
                      {selectedTemplate.name}
                    </span>{' '}
                    预设角色
                  </h3>
                  <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">
                    {selectedTemplate.category === 'custom'
                      ? `此自定义模板包含 ${
                          selectedTemplate.agents?.length || 0
                        } 个配置好的智能体。`
                      : `此系统模板将自动生成 ${
                          selectedTemplate.sceneType === 'council'
                            ? 5
                            : selectedTemplate.sceneType === 'werewolf'
                            ? 9
                            : 2
                        } 个标准角色。`}
                  </p>
                </div>
              )}

              {/* MODE: AI GENERATE */}
              {importMode === 'generate' && (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-purple-50 border border-purple-100 p-4 rounded-lg">
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-purple-800 mb-2">
                        生成数量
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
                      <label className="block text-xs font-bold text-purple-800 mb-2">
                        群体画像描述 (Population Distribution)
                      </label>
                      <textarea
                        value={genDesc}
                        onChange={(e) => setGenDesc(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-200 rounded text-sm focus:ring-purple-500 h-20 resize-none"
                        placeholder="描述群体的构成，例如：'一个包括5名居民的小镇，其中2名是保守派农民，2名是年轻激进的学生，1名是中立的教师。'"
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
                        开始生成
                      </button>
                    </div>
                  </div>

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
                          已生成 {customAgents.length} 个智能体
                        </span>
                        <button
                          onClick={() => setCustomAgents([])}
                          className="text-xs text-red-500 hover:underline"
                        >
                          清空重置
                        </button>
                      </div>
                      <div className="overflow-y-auto flex-1 p-0">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 sticky top-0 text-slate-500">
                            <tr>
                              <th className="px-4 py-2">姓名</th>
                              <th className="px-4 py-2">角色</th>
                              <th className="px-4 py-2">画像描述</th>
                              <th className="px-4 py-2">初始属性</th>
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
                        点击上传 CSV 或 JSON
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        必填字段：agent_name, agent_description；其余列将作为属性保留
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
                      <div className="px-4 py-2 bg-slate-50 border-b">
                        <span className="text-xs font-bold text-slate-700">
                          已解析 {customAgents.length} 个智能体
                        </span>
                      </div>
                      <div className="overflow-y-auto flex-1 p-0">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2">Name</th>
                              <th className="px-4 py-2">Role</th>
                              <th className="px-4 py-2">Model</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customAgents.map((a, i) => (
                              <tr
                                key={i}
                                className="border-b"
                              >
                                <td className="px-4 py-2">{a.name}</td>
                                <td className="px-4 py-2">{a.role}</td>
                                <td className="px-4 py-2">
                                  {a.llmConfig?.model}
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
                准备就绪
              </h3>
              <div className="bg-slate-50 rounded-lg p-6 max-w-md mx-auto text-left space-y-3 border">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">模板:</span>
                  <span className="font-bold text-slate-800">
                    {selectedTemplate.name}
                  </span>
                </div>
                {(importMode === 'custom' || importMode === 'generate') &&
                  customAgents.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">自定义角色:</span>
                      <span className="font-bold text-brand-600">
                        {customAgents.length} 人
                      </span>
                    </div>
                  )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">时间流速:</span>
                  <span className="font-bold text-slate-800">
                    1 回合 = {timeStep}{' '}
                    {
                      TIME_UNITS.find((u) => u.value === timeUnit)
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
              上一步
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => toggleWizard(false)}
              className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
            >
              取消
            </button>
          )}
          {step < 3 && (
            <button
              onClick={handleNext}
              className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm"
            >
              下一步
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
                  <Loader2 size={16} className="animate-spin" /> 保存中...
                </span>
              ) : (
                '开始仿真'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

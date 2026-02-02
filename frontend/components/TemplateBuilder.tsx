// frontend/components/TemplateBuilder.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Settings,
  Zap,
  Users,
  Globe
} from 'lucide-react';
import {
  CoreMechanicConfig,
  CoreMechanicType,
  SemanticActionConfig,
  AgentArchetypeConfig,
  GenericTemplateConfig,
  TimeConfig,
  TimeUnit
} from '../types';

interface TemplateBuilderProps {
  template: GenericTemplateConfig;
  onChange: (template: GenericTemplateConfig) => void;
  timeConfig?: TimeConfig;
  onTimeConfigChange?: (config: TimeConfig) => void;
}

const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: 'minute', label: 'Minutes' },
  { value: 'hour', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' }
];

const CORE_MECHANIC_DEFINITIONS: Record<CoreMechanicType, { name: string; description: string; configFields?: { key: string; label: string; type: 'text' | 'number' | 'boolean'; default: any }[] }> = {
  grid: {
    name: 'Grid',
    description: 'Agents exist on a spatial grid with movement and location-based interactions',
    configFields: [
      { key: 'width', label: 'Grid Width', type: 'number', default: 10 },
      { key: 'height', label: 'Grid Height', type: 'number', default: 10 },
      { key: 'wrapAround', label: 'Wrap Around Edges', type: 'boolean', default: false }
    ]
  },
  discussion: {
    name: 'Discussion',
    description: 'Agents can participate in structured discussions with turn-taking',
    configFields: [
      { key: 'maxTurns', label: 'Max Turns per Round', type: 'number', default: 3 },
      { key: 'allowInterruption', label: 'Allow Interruptions', type: 'boolean', default: false }
    ]
  },
  voting: {
    name: 'Voting',
    description: 'Agents can vote on proposals with configurable voting rules',
    configFields: [
      { key: 'quorum', label: 'Quorum (%)', type: 'number', default: 50 },
      { key: 'majority', label: 'Majority Required (%)', type: 'number', default: 51 }
    ]
  },
  resources: {
    name: 'Resources',
    description: 'Agents have resources that can be gathered, traded, and consumed',
    configFields: [
      { key: 'initialAmount', label: 'Initial Amount', type: 'number', default: 100 },
      { key: 'renewable', label: 'Renewable Resources', type: 'boolean', default: true }
    ]
  },
  hierarchy: {
    name: 'Hierarchy',
    description: 'Agents exist in a hierarchical structure with authority levels',
    configFields: [
      { key: 'levels', label: 'Hierarchy Levels', type: 'number', default: 3 },
      { key: 'enforceChain', label: 'Enforce Chain of Command', type: 'boolean', default: true }
    ]
  },
  time: {
    name: 'Time',
    description: 'Time progression with configurable units and steps',
    configFields: []
  }
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const createEmptyAction = (): SemanticActionConfig => ({
  name: '',
  description: '',
  instruction: '',
  parameters: {},
  effect: ''
});

const createEmptyArchetype = (): AgentArchetypeConfig => ({
  name: '',
  rolePrompt: '',
  style: '',
  userProfile: '',
  properties: {},
  allowedActions: []
});

const createEmptyCoreMechanic = (type: CoreMechanicType): CoreMechanicConfig => {
  const def = CORE_MECHANIC_DEFINITIONS[type];
  const config: Record<string, any> = {};
  def.configFields?.forEach(field => {
    config[field.key] = field.default;
  });
  return { type, enabled: false, config };
};

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  template,
  onChange,
  timeConfig,
  onTimeConfigChange
}) => {
  const { t } = useTranslation();
  const [expandedMechanic, setExpandedMechanic] = useState<CoreMechanicType | null>(null);

  const updateTemplate = (updates: Partial<GenericTemplateConfig>) => {
    onChange({ ...template, ...updates });
  };

  const updateBasicInfo = (field: 'name' | 'description', value: string) => {
    updateTemplate({ [field]: value });
  };

  const toggleCoreMechanic = (type: CoreMechanicType) => {
    const updated = template.coreMechanics.map(m =>
      m.type === type ? { ...m, enabled: !m.enabled } : m
    );
    updateTemplate({ coreMechanics: updated });
  };

  const updateCoreMechanicConfig = (type: CoreMechanicType, key: string, value: any) => {
    const updated = template.coreMechanics.map(m =>
      m.type === type ? { ...m, config: { ...m.config, [key]: value } } : m
    );
    updateTemplate({ coreMechanics: updated });
  };

  const addSemanticAction = () => {
    updateTemplate({
      semanticActions: [...template.semanticActions, { ...createEmptyAction(), id: generateId() }]
    });
  };

  const updateSemanticAction = (index: number, field: keyof SemanticActionConfig, value: any) => {
    const updated = template.semanticActions.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    updateTemplate({ semanticActions: updated });
  };

  const removeSemanticAction = (index: number) => {
    updateTemplate({
      semanticActions: template.semanticActions.filter((_, i) => i !== index)
    });
  };

  const addAgentArchetype = () => {
    updateTemplate({
      agentArchetypes: [...template.agentArchetypes, { ...createEmptyArchetype(), id: generateId() }]
    });
  };

  const updateAgentArchetype = (index: number, field: keyof AgentArchetypeConfig, value: any) => {
    const updated = template.agentArchetypes.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    updateTemplate({ agentArchetypes: updated });
  };

  const removeAgentArchetype = (index: number) => {
    updateTemplate({
      agentArchetypes: template.agentArchetypes.filter((_, i) => i !== index)
    });
  };

  const updateEnvironment = (field: 'description' | 'rules', value: any) => {
    updateTemplate({
      environment: { ...template.environment, [field]: value }
    });
  };

  const addEnvironmentRule = () => {
    const rules = template.environment.rules || [];
    updateTemplate({
      environment: { ...template.environment, rules: [...rules, ''] }
    });
  };

  const updateEnvironmentRule = (index: number, value: string) => {
    const rules = template.environment.rules || [];
    updateTemplate({
      environment: {
        ...template.environment,
        rules: rules.map((r, i) => i === index ? value : r)
      }
    });
  };

  const removeEnvironmentRule = (index: number) => {
    const rules = template.environment.rules || [];
    updateTemplate({
      environment: {
        ...template.environment,
        rules: rules.filter((_, i) => i !== index)
      }
    });
  };

  const updateTimeConfig = (field: keyof TimeConfig, value: any) => {
    if (onTimeConfigChange) {
      onTimeConfigChange({ ...timeConfig!, [field]: value });
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Settings size={16} />
          {t('templateBuilder.basicInfo', { defaultValue: 'Basic Information' })}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('templateBuilder.templateName', { defaultValue: 'Template Name' })}
            </label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => updateBasicInfo('name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder={t('templateBuilder.placeholders.name', { defaultValue: 'e.g., Town Hall Meeting' })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('templateBuilder.description', { defaultValue: 'Description' })}
            </label>
            <textarea
              value={template.description}
              onChange={(e) => updateBasicInfo('description', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              rows={2}
              placeholder={t('templateBuilder.placeholders.description', { defaultValue: 'Describe what this template simulates...' })}
            />
          </div>
        </div>
      </div>

      {/* Core Mechanics */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Zap size={16} />
          {t('templateBuilder.coreMechanics', { defaultValue: 'Core Mechanics' })}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          {t('templateBuilder.coreMechanicsHint', { defaultValue: 'Select the core mechanics to enable in this template' })}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(CORE_MECHANIC_DEFINITIONS).map(([type, def]) => {
            const mechanic = template.coreMechanics.find(m => m.type === type);
            const isEnabled = mechanic?.enabled || false;

            return (
              <div key={type} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleCoreMechanic(type as CoreMechanicType)}
                      className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <span className="font-medium text-sm text-slate-700">{def.name}</span>
                  </div>
                  <button
                    onClick={() => setExpandedMechanic(expandedMechanic === type ? null : type as CoreMechanicType)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    {expandedMechanic === type ? '▲' : '▼'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-2">{def.description}</p>

                {isEnabled && expandedMechanic === type && def.configFields && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    {def.configFields.map(field => (
                      <div key={field.key}>
                        <label className="block text-xs text-slate-600 mb-1">{field.label}</label>
                        {field.type === 'boolean' ? (
                          <select
                            value={mechanic?.config[field.key]?.toString() || field.default.toString()}
                            onChange={(e) => updateCoreMechanicConfig(type as CoreMechanicType, field.key, e.target.value === 'true')}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                          >
                            <option value="true">{t('common.yes', { defaultValue: 'Yes' })}</option>
                            <option value="false">{t('common.no', { defaultValue: 'No' })}</option>
                          </select>
                        ) : field.type === 'number' ? (
                          <input
                            type="number"
                            value={mechanic?.config[field.key] ?? field.default}
                            onChange={(e) => updateCoreMechanicConfig(type as CoreMechanicType, field.key, parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={mechanic?.config[field.key] || ''}
                            onChange={(e) => updateCoreMechanicConfig(type as CoreMechanicType, field.key, e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Semantic Actions */}
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Zap size={16} />
            {t('templateBuilder.semanticActions', { defaultValue: 'Semantic Actions' })}
          </h3>
          <button
            onClick={addSemanticAction}
            className="text-xs px-2 py-1 bg-brand-100 text-brand-700 rounded hover:bg-brand-200 flex items-center gap-1"
          >
            <Plus size={12} />
            {t('templateBuilder.addAction', { defaultValue: 'Add Action' })}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {t('templateBuilder.semanticActionsHint', { defaultValue: 'Define custom actions agents can perform in this simulation' })}
        </p>

        <div className="space-y-3">
          {template.semanticActions.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 rounded border border-dashed border-slate-200">
              {t('templateBuilder.noActions', { defaultValue: 'No semantic actions defined yet' })}
            </div>
          ) : (
            template.semanticActions.map((action, index) => (
              <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <input
                    type="text"
                    value={action.name}
                    onChange={(e) => updateSemanticAction(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm font-medium"
                    placeholder={t('templateBuilder.actionName', { defaultValue: 'Action Name' })}
                  />
                  <button
                    onClick={() => removeSemanticAction(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={action.description}
                  onChange={(e) => updateSemanticAction(index, 'description', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm mb-2"
                  placeholder={t('templateBuilder.actionDescription', { defaultValue: 'Short description' })}
                />
                <textarea
                  value={action.instruction}
                  onChange={(e) => updateSemanticAction(index, 'instruction', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm mb-2 resize-none"
                  rows={2}
                  placeholder={t('templateBuilder.actionInstruction', { defaultValue: 'LLM instruction for this action...' })}
                />
                <input
                  type="text"
                  value={action.effect || ''}
                  onChange={(e) => updateSemanticAction(index, 'effect', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                  placeholder={t('templateBuilder.actionEffect', { defaultValue: 'Effect on simulation state (optional)' })}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agent Archetypes */}
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users size={16} />
            {t('templateBuilder.agentArchetypes', { defaultValue: 'Agent Archetypes' })}
          </h3>
          <button
            onClick={addAgentArchetype}
            className="text-xs px-2 py-1 bg-brand-100 text-brand-700 rounded hover:bg-brand-200 flex items-center gap-1"
          >
            <Plus size={12} />
            {t('templateBuilder.addArchetype', { defaultValue: 'Add Archetype' })}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {t('templateBuilder.agentArchetypesHint', { defaultValue: 'Define agent archetypes for population generation' })}
        </p>

        <div className="space-y-3">
          {template.agentArchetypes.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 rounded border border-dashed border-slate-200">
              {t('templateBuilder.noArchetypes', { defaultValue: 'No agent archetypes defined yet' })}
            </div>
          ) : (
            template.agentArchetypes.map((archetype, index) => (
              <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <input
                    type="text"
                    value={archetype.name}
                    onChange={(e) => updateAgentArchetype(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm font-medium"
                    placeholder={t('templateBuilder.archetypeName', { defaultValue: 'Archetype Name' })}
                  />
                  <button
                    onClick={() => removeAgentArchetype(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={archetype.rolePrompt}
                  onChange={(e) => updateAgentArchetype(index, 'rolePrompt', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm mb-2 resize-none"
                  rows={2}
                  placeholder={t('templateBuilder.rolePrompt', { defaultValue: 'Role prompt for this archetype...' })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={archetype.style || ''}
                    onChange={(e) => updateAgentArchetype(index, 'style', e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded text-sm"
                    placeholder={t('templateBuilder.style', { defaultValue: 'Style (optional)' })}
                  />
                  <input
                    type="text"
                    value={archetype.allowedActions?.join(', ') || ''}
                    onChange={(e) => updateAgentArchetype(index, 'allowedActions', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    className="px-2 py-1 border border-slate-200 rounded text-sm"
                    placeholder={t('templateBuilder.allowedActions', { defaultValue: 'Allowed actions (comma separated)' })}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Environment */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Globe size={16} />
          {t('templateBuilder.environment', { defaultValue: 'Environment' })}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('templateBuilder.environmentDescription', { defaultValue: 'Environment Description' })}
            </label>
            <textarea
              value={template.environment.description}
              onChange={(e) => updateEnvironment('description', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              rows={3}
              placeholder={t('templateBuilder.placeholders.environment', { defaultValue: 'Describe the simulation environment...' })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-600">
                {t('templateBuilder.environmentRules', { defaultValue: 'Environment Rules' })}
              </label>
              <button
                onClick={addEnvironmentRule}
                className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 flex items-center gap-1"
              >
                <Plus size={12} />
                {t('templateBuilder.addRule', { defaultValue: 'Add Rule' })}
              </button>
            </div>
            <div className="space-y-2">
              {(!template.environment.rules || template.environment.rules.length === 0) ? (
                <div className="text-center py-2 text-slate-400 text-sm bg-slate-50 rounded border border-dashed border-slate-200">
                  {t('templateBuilder.noRules', { defaultValue: 'No rules defined' })}
                </div>
              ) : (
                template.environment.rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{index + 1}.</span>
                    <input
                      type="text"
                      value={rule}
                      onChange={(e) => updateEnvironmentRule(index, e.target.value)}
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                      placeholder={t('templateBuilder.rulePlaceholder', { defaultValue: 'Enter a rule...' })}
                    />
                    <button
                      onClick={() => removeEnvironmentRule(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Time Configuration */}
      {onTimeConfigChange && timeConfig && (
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-4">
            {t('templateBuilder.timeConfig', { defaultValue: 'Time Configuration' })}
          </h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-600 mb-1">{t('templateBuilder.baseTime', { defaultValue: 'Base Time' })}</label>
              <input
                type="datetime-local"
                value={timeConfig.baseTime.slice(0, 16)}
                onChange={(e) => updateTimeConfig('baseTime', new Date(e.target.value).toISOString())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-600 mb-1">{t('templateBuilder.timeUnit', { defaultValue: 'Time Unit' })}</label>
              <select
                value={timeConfig.unit}
                onChange={(e) => updateTimeConfig('unit', e.target.value as TimeUnit)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {TIME_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs text-slate-600 mb-1">{t('templateBuilder.timeStep', { defaultValue: 'Step' })}</label>
              <input
                type="number"
                min="1"
                value={timeConfig.step}
                onChange={(e) => updateTimeConfig('step', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const createEmptyGenericTemplate = (): GenericTemplateConfig => ({
  id: generateId(),
  name: '',
  description: '',
  version: '1.0.0',
  coreMechanics: [
    createEmptyCoreMechanic('grid'),
    createEmptyCoreMechanic('discussion'),
    createEmptyCoreMechanic('voting'),
    createEmptyCoreMechanic('resources'),
    createEmptyCoreMechanic('hierarchy'),
    createEmptyCoreMechanic('time')
  ],
  semanticActions: [],
  agentArchetypes: [],
  environment: {
    description: '',
    rules: []
  },
  defaultTimeConfig: {
    baseTime: new Date().toISOString(),
    unit: 'hour',
    step: 1
  }
});

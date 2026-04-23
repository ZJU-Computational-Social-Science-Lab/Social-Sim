
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationStore } from '../store';
import { applyEnvironmentEvent, generateSuggestions, type EnvironmentSuggestion } from '../services/environmentSuggestions';
import { Megaphone, CloudLightning, Edit, Save, Sparkles, Loader2, Check, FilePlus } from 'lucide-react';
import { MultimodalInput } from './MultimodalInput';
import { InitialEventsModal } from './InitialEventsModal';

const humanizeBackendLabel = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const HostPanel: React.FC = () => {
   const { t } = useTranslation();
  const agents = useSimulationStore(state => state.agents);
  const currentSimulation = useSimulationStore(state => state.currentSimulation);
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
  const injectLog = useSimulationStore(state => state.injectLog);
  const updateAgentProperty = useSimulationStore(state => state.updateAgentProperty);
  const addNotification = useSimulationStore(state => state.addNotification);
  const toggleInitialEvents = useSimulationStore((state: any) => state.toggleInitialEvents);

  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [envEvent, setEnvEvent] = useState('');
  const [envImage, setEnvImage] = useState<string | null>(null);
  const [broadcastRecipients, setBroadcastRecipients] = useState<string[]>([]);

  // God Mode State
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || '');
  const [selectedProp, setSelectedProp] = useState('');
  const [propValue, setPropValue] = useState('');

  // #12 Environment Suggestions
  const [suggestions, setSuggestions] = useState<EnvironmentSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const translateSuggestionEventType = (eventType: string) => {
    const key = `components.environmentSuggestion.eventType.${eventType}`;
    const translated = t(key);
    return translated === key ? humanizeBackendLabel(eventType) : translated;
  };

  const translateSuggestionSeverity = (severity: string) => {
    const key = `components.environmentSuggestion.severity.${severity}`;
    const translated = t(key);
    return translated === key ? humanizeBackendLabel(severity) : translated;
  };

  const formatBroadcastLog = (description: string) => {
    const recipients = broadcastRecipients.filter(Boolean);
    const scopeLabel = recipients.length > 0
      ? t('components.hostPanel.privateBroadcastLog', '定向私有广播')
      : t('components.hostPanel.globalBroadcastLog', '全局广播');
    const recipientLabel = recipients.length > 0
      ? recipients.join(', ')
      : t('components.hostPanel.allAgentsLog', '全体智能体');
    return `${scopeLabel}\n${t('components.hostPanel.recipientsLog', '接收者')}: ${recipientLabel}\n${description}`;
  };

  const pushEnvironmentEvent = async (description: string, eventType: string) => {
    if (!description.trim()) return;
    const recipients = eventType === 'broadcast' && broadcastRecipients.length > 0
      ? broadcastRecipients
      : undefined;

    const shouldCallBackend = !!currentSimulation?.id;
    if (shouldCallBackend) {
      const isPolicyScene = currentSimulation?.scene_type === 'policy_cascade_scene';
      const payload: any = {
        event_type: eventType,
        description,
        severity: 'mild',
        receivers: recipients,
        node_id: selectedNodeId,
      };
      // Only include explicit notice_only for policy cascade scene to avoid
      // changing semantics in other scene types.
      if (isPolicyScene) {
        payload.notice_only = eventType !== 'broadcast';
      }
      await applyEnvironmentEvent(currentSimulation!.id, payload);
    }

    const logContent = eventType === 'broadcast' ? formatBroadcastLog(description) : description;
    injectLog(eventType === 'broadcast' ? 'SYSTEM' : 'ENVIRONMENT', logContent, envImage || undefined);
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    await pushEnvironmentEvent(`${t('components.hostPanel.logPrefixSystemAnnouncement')} ${broadcastMsg}`, 'broadcast');
    setBroadcastMsg('');
  };

  const handleEnvEvent = async (text: string = envEvent) => {
    if (!text.trim() && !envImage) return;
    await pushEnvironmentEvent(`${t('components.hostPanel.logPrefixEnvironmentEvent')} ${text}`, 'environment');
    if (text === envEvent) {
       setEnvEvent('');
       setEnvImage(null);
    }
  };

  const handleUpdateProp = () => {
    if (!selectedAgentId || !selectedProp) return;
    // Auto convert to number if it looks like one
    const val = !isNaN(Number(propValue)) ? Number(propValue) : propValue;
    updateAgentProperty(selectedAgentId, selectedProp, val);
    setPropValue('');
  };

  const handleGetSuggestions = async () => {
    if (!currentSimulation?.id) {
      addNotification('error', t('components.hostPanel.fetchSuggestionsFailed'));
      return;
    }

    setIsSuggesting(true);
    try {
      const result = await generateSuggestions(currentSimulation.id, selectedNodeId);
      setSuggestions(result.suggestions || []);
    } catch (e) {
      addNotification('error', t('components.hostPanel.fetchSuggestionsFailed'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAdoptSuggestion = (suggestion: EnvironmentSuggestion) => {
    void handleEnvEvent(suggestion.description);
    // Remove from list
    setSuggestions(prev => prev.filter(s => s.description !== suggestion.description));
    addNotification('success', t('components.hostPanel.suggestionAdopted'));
  };

  // Sync prop selection with agent
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const properties = selectedAgent ? Object.keys(selectedAgent.properties) : [];

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--ss-workspace-surface)' }}>
      <div className="p-3 border-b bg-amber-50/50">
         <p className="text-xs text-amber-800 leading-relaxed">
           <strong>{t('components.hostPanel.godModeTitle')}</strong>: {t('components.hostPanel.godModeDescription')}
         </p>
         <button
           onClick={() => toggleInitialEvents(true)}
           className="mt-2 text-[11px] px-2 py-1 border border-amber-200 text-amber-700 rounded flex items-center gap-1"
           style={{ background: 'var(--ss-workspace-surface)' }}
         >
           <FilePlus size={12} /> {t('components.hostPanel.initialEventsEditor')}
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* #12 Environment Advisor */}
        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-indigo-800 flex items-center gap-1">
              <Sparkles size={14} /> {t('components.hostPanel.aiAdvisor')}
            </label>
            <button
              onClick={handleGetSuggestions}
              disabled={isSuggesting}
              className="text-[10px] border border-indigo-200 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 disabled:opacity-50"
              style={{ background: 'var(--ss-workspace-surface)' }}
            >
              {isSuggesting ? <Loader2 size={10} className="animate-spin inline" /> : t('components.hostPanel.getSuggestions')}
            </button>
          </div>

          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="p-2 rounded border border-indigo-100 text-xs shadow-sm group" style={{ background: 'var(--ss-workspace-surface)' }}>
                  <p className="font-bold mb-1" style={{ color: 'var(--ss-workspace-heading)' }}>{s.description}</p>
                  <p className="text-[10px] mb-2 uppercase tracking-[0.12em]" style={{ color: 'var(--ss-workspace-muted)' }}>
                    {translateSuggestionEventType(s.event_type)} · {translateSuggestionSeverity(s.severity)}
                  </p>
                  <button
                    onClick={() => handleAdoptSuggestion(s)}
                    className="w-full py-1 bg-indigo-50 text-indigo-600 font-bold rounded hover:bg-indigo-100 flex items-center justify-center gap-1 opacity-80 hover:opacity-100"
                  >
                    <Check size={12} /> {t('components.hostPanel.adoptEvent')}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-indigo-300 text-xs italic">
               {t('components.hostPanel.getSuggestionsHint')}
            </div>
          )}
        </div>

        <hr style={{ borderColor: 'var(--ss-border)' }} />

        {/* Broadcast */}
        <div className="space-y-2">
          <label className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--ss-workspace-heading)' }}>
            <Megaphone size={14} /> {t('components.hostPanel.systemBroadcast')}
          </label>
          <div className="text-[11px] mb-1" style={{ color: 'var(--ss-workspace-muted)' }}>
            {t('components.hostPanel.recipientHint', '选择接收者（为空则全员）：')}
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {agents.map((a) => {
              const checked = broadcastRecipients.includes(a.name) || broadcastRecipients.includes(a.id);
              return (
                <label key={a.id} className="flex items-center gap-1 text-[11px] px-2 py-1 border rounded cursor-pointer" style={{ borderColor: 'var(--ss-workspace-border)', background: 'var(--ss-workspace-surface)' }}>
                  <input
                    type="checkbox"
                    className="accent-brand-500"
                    checked={checked}
                    onChange={(e) => {
                      setBroadcastRecipients((prev) => {
                        const key = a.name;
                        if (e.target.checked) return Array.from(new Set([...prev, key]));
                        return prev.filter((v) => v !== key);
                      });
                    }}
                  />
                  <span>{a.name}</span>
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder={t('components.hostPanel.broadcastPlaceholder')}
              className="flex-1 text-sm border rounded p-2 focus:ring-1 focus:ring-brand-500 outline-none resize-none h-20"
            />
          </div>
          <button
            onClick={handleBroadcast}
            disabled={!broadcastMsg}
            className="w-full py-1.5 text-xs text-white rounded disabled:opacity-50"
            style={{ background: 'var(--ss-neutral-900)' }}
          >
            {t('components.hostPanel.sendBroadcast')}
          </button>
        </div>

        <hr style={{ borderColor: 'var(--ss-border)' }} />

        {/* Environment with Multimodal Support #24 */}
        <div className="space-y-2">
          <label className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--ss-workspace-heading)' }}>
            <CloudLightning size={14} /> {t('components.hostPanel.injectEvent')}
          </label>
          {currentSimulation?.scene_type === 'policy_cascade_scene' && (
            <div className="text-[11px] italic" style={{ color: 'var(--ss-workspace-muted)' }}>
              {t('components.hostPanel.injectNoticeOnly', '注：注入环境事件为 notice-only（不触发系统广播），用于干预后续事件。')}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={envEvent}
              onChange={(e) => setEnvEvent(e.target.value)}
              placeholder={t('components.hostPanel.eventPlaceholder')}
              className="w-full text-sm border rounded px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none"
            />

            <MultimodalInput
              label={t('components.hostPanel.imageLabel')}
              helperText={t('components.hostPanel.imageHelper')}
              presetUrl={envImage}
              onInsert={(url) => {
               setEnvImage(url);
               addNotification('success', t('components.hostPanel.imageUploaded'));
              }}
            />
          </div>
          <button
            onClick={() => handleEnvEvent()}
            disabled={!envEvent && !envImage}
            className="w-full py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {t('components.hostPanel.triggerEvent')}
          </button>
        </div>

        <hr style={{ borderColor: 'var(--ss-border)' }} />

        {/* State Editing */}
        <div className="space-y-3 p-3 rounded-lg border" style={{ background: 'var(--ss-surface-strong)' }}>
          <label className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--ss-workspace-heading)' }}>
            <Edit size={14} /> {t('components.hostPanel.modifyState')}
          </label>

          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setSelectedProp('');
              setPropValue('');
            }}
            className="w-full text-xs border rounded px-2 py-1.5"
            style={{ background: 'var(--ss-workspace-surface)' }}
          >
            {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>

          <select
            value={selectedProp}
            onChange={(e) => setSelectedProp(e.target.value)}
            disabled={!selectedAgent}
            className="w-full text-xs border rounded px-2 py-1.5 disabled:opacity-50"
            style={{ background: 'var(--ss-workspace-surface)' }}
          >
            <option value="">{t('components.hostPanel.selectProperty')}</option>
            {properties.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <input
            type="text"
            value={propValue}
            onChange={(e) => setPropValue(e.target.value)}
            placeholder={t('components.hostPanel.enterNewValue')}
            disabled={!selectedProp}
            className="w-full text-xs border rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
            style={{ background: !selectedProp ? 'var(--ss-surface-inset)' : 'var(--ss-workspace-surface)' }}
          />

          <button
            onClick={handleUpdateProp}
            disabled={!selectedProp || !propValue}
            className="w-full py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Save size={12} /> {t('components.hostPanel.updateProperty')}
          </button>
        </div>

      </div>
      <InitialEventsModal />
    </div>
  );
};

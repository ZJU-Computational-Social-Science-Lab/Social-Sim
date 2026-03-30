
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationStore, fetchEnvironmentSuggestions } from '../store';
import { applyEnvironmentEvent } from '../services/environmentSuggestions';
import { Megaphone, CloudLightning, Edit, Save, Sparkles, Loader2, Check, FilePlus } from 'lucide-react';
import { MultimodalInput } from './MultimodalInput';
import { InitialEventsModal } from './InitialEventsModal';
import { injectHostMessage } from '../services/simulationTree';
import { API_BASE_URL } from '../services/client';
import { useAuthStore } from '../store/auth';

export const HostPanel: React.FC = () => {
  const { t } = useTranslation();
  const agents = useSimulationStore(state => state.agents);
  const logs = useSimulationStore(state => state.logs);
  const currentSimulation = useSimulationStore(state => state.currentSimulation);
  const engineMode = useSimulationStore(state => state.engineConfig.mode);
  const injectLog = useSimulationStore(state => state.injectLog);
  const updateAgentProperty = useSimulationStore(state => state.updateAgentProperty);
  const addNotification = useSimulationStore(state => state.addNotification);
  const toggleInitialEvents = useSimulationStore((state: any) => state.toggleInitialEvents);
  const selectedNodeId = useSimulationStore((state: any) => state.selectedNodeId);

  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [envEvent, setEnvEvent] = useState('');
  const [envImage, setEnvImage] = useState<string | null>(null);
  const [broadcastRecipients, setBroadcastRecipients] = useState<string[]>([]);

  // God Mode State
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || '');
  const [selectedProp, setSelectedProp] = useState('');
  const [propValue, setPropValue] = useState('');

  // #12 Environment Suggestions
  const [suggestions, setSuggestions] = useState<Array<{event: string, reason: string}>>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

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

  // Shared function for pushing environment events
  const pushEnvironmentEvent = async (description: string, eventType: string) => {
    if (!description.trim()) return;
    const recipients = eventType === 'broadcast' && broadcastRecipients.length > 0
      ? broadcastRecipients
      : undefined;

    const shouldCallBackend = engineMode === 'connected' && currentSimulation?.id;
    if (shouldCallBackend) {
      const isPolicyScene = currentSimulation?.scene_type === 'policy_cascade_scene';
      const payload: any = {
        event_type: eventType,
        description,
        severity: 'mild',
        receivers: recipients,
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

    const message = `${t('components.hostPanel.logPrefixSystemAnnouncement')} ${broadcastMsg}`;

    // Log to UI
    injectLog('SYSTEM', message);

    // Experiment simulations: use experiment-specific API for message injection
    if (currentSimulation?.id && selectedNodeId) {
      try {
        await injectHostMessage(API_BASE_URL, currentSimulation.id, selectedNodeId, broadcastMsg, useAuthStore.getState().accessToken);
        addNotification('success', t('components.hostPanel.broadcastSent'));
      } catch (error) {
        console.error('Failed to inject host message:', error);
        addNotification('error', t('components.hostPanel.broadcastFailed'));
      }
    } else if (engineMode === 'connected' && currentSimulation?.id) {
      // Regular connected simulations: use general environment event API
      await applyEnvironmentEvent(currentSimulation.id, {
        event_type: 'broadcast',
        description: message,
        severity: 'mild',
        receivers: broadcastRecipients.length > 0 ? broadcastRecipients : undefined,
      });
    }

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
    setIsSuggesting(true);
    try {
      const results = await fetchEnvironmentSuggestions(logs, agents);
      setSuggestions(results);
    } catch (e) {
      addNotification('error', t('components.hostPanel.fetchSuggestionsFailed'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAdoptSuggestion = (eventText: string) => {
    handleEnvEvent(eventText);
    // Remove from list
    setSuggestions(prev => prev.filter(s => s.event !== eventText));
    addNotification('success', t('components.hostPanel.suggestionAdopted'));
  };

  // Sync prop selection with agent
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const properties = selectedAgent ? Object.keys(selectedAgent.properties) : [];

  return (
    <div className="ss-host-panel flex h-full flex-col">
      <div className="border-b border-[var(--ss-workspace-border)] bg-[rgba(124,111,168,0.08)] p-3">
         <p className="text-xs leading-relaxed text-[var(--ss-workspace-text)]">
           <strong>{t('components.hostPanel.godModeTitle')}</strong>: {t('components.hostPanel.godModeDescription')}
         </p>
         <button
           onClick={() => toggleInitialEvents(true)}
           className="ss-button-secondary mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px]"
         >
           <FilePlus size={12} /> {t('components.hostPanel.initialEventsEditor')}
         </button>
      </div>

      <div className="ss-host-panel__body flex-1 space-y-6 overflow-y-auto">
        
        {/* #12 Environment Advisor */}
        <div className="ss-host-panel__section">
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-1 text-xs font-bold text-[#DDD7F5]">
              <Sparkles size={14} /> {t('components.hostPanel.aiAdvisor')}
            </label>
            <button
              onClick={handleGetSuggestions}
              disabled={isSuggesting}
              className="ss-button-secondary px-2 py-1 text-[10px] disabled:opacity-50"
            >
              {isSuggesting ? <Loader2 size={10} className="animate-spin inline" /> : t('components.hostPanel.getSuggestions')}
            </button>
          </div>
          
          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="group rounded-2xl border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] p-2 text-xs shadow-sm">
                  <p className="mb-1 font-bold text-[var(--ss-workspace-heading)]">{s.event}</p>
                  <p className="mb-2 text-[10px] text-[var(--ss-workspace-muted)]">{s.reason}</p>
                  <button
                    onClick={() => handleAdoptSuggestion(s.event)}
                    className="ss-button-secondary flex w-full items-center justify-center gap-1 py-1 font-bold opacity-80 hover:opacity-100"
                  >
                    <Check size={12} /> {t('components.hostPanel.adoptEvent')}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs italic text-[var(--ss-workspace-muted)]">
               {t('components.hostPanel.getSuggestionsHint')}
            </div>
          )}
        </div>

        <hr className="border-[var(--ss-workspace-border)]" />

        {/* Broadcast */}
        <div className="ss-host-panel__section space-y-2">
          <label className="flex items-center gap-1 text-xs font-bold text-[var(--ss-workspace-heading)]">
            <Megaphone size={14} /> {t('components.hostPanel.systemBroadcast')}
          </label>
          <div className="mb-1 text-[11px] text-[var(--ss-workspace-muted)]">
            {t('components.hostPanel.recipientHint', '选择接收者（为空则全员）：')}
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {agents.map((a) => {
              const checked = broadcastRecipients.includes(a.name) || broadcastRecipients.includes(a.id);
              return (
                <label key={a.id} className="flex cursor-pointer items-center gap-1 rounded-full border border-[var(--ss-workspace-border)] bg-[var(--ss-workspace-surface)] px-2 py-1 text-[11px] hover:bg-black/5">
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
              className="ss-input h-20 flex-1 resize-none p-2 text-sm"
            />
          </div>
          <button
            onClick={handleBroadcast}
            disabled={!broadcastMsg}
            className="ss-button w-full py-1.5 text-xs disabled:opacity-50"
          >
            {t('components.hostPanel.sendBroadcast')}
          </button>
        </div>

        <hr className="border-[var(--ss-workspace-border)]" />

        {/* Environment with Multimodal Support #24 */}
        <div className="ss-host-panel__section space-y-2">
          <label className="flex items-center gap-1 text-xs font-bold text-[var(--ss-workspace-heading)]">
            <CloudLightning size={14} /> {t('components.hostPanel.injectEvent')}
          </label>
          {currentSimulation?.scene_type === 'policy_cascade_scene' && (
            <div className="text-[11px] italic text-[var(--ss-workspace-muted)]">
              {t('components.hostPanel.injectNoticeOnly', '注：注入环境事件为 notice-only（不触发系统广播），用于干预后续事件。')}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={envEvent}
              onChange={(e) => setEnvEvent(e.target.value)}
              placeholder={t('components.hostPanel.eventPlaceholder')}
              className="ss-input w-full px-2 py-1.5 text-sm"
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
            className="ss-button w-full py-1.5 text-xs disabled:opacity-50"
          >
            {t('components.hostPanel.triggerEvent')}
          </button>
        </div>

        <hr className="border-[var(--ss-workspace-border)]" />

        {/* State Editing */}
        <div className="ss-host-panel__section space-y-3">
          <label className="flex items-center gap-1 text-xs font-bold text-[var(--ss-workspace-heading)]">
            <Edit size={14} /> {t('components.hostPanel.modifyState')}
          </label>

          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setSelectedProp('');
              setPropValue('');
            }}
            className="ss-input w-full px-2 py-1.5 text-xs"
          >
            {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>

          <select
            value={selectedProp}
            onChange={(e) => setSelectedProp(e.target.value)}
            disabled={!selectedAgent}
            className="ss-input w-full px-2 py-1.5 text-xs disabled:opacity-50"
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
            className="ss-input w-full px-2 py-1.5 text-xs disabled:opacity-50"
          />

          <button
            onClick={handleUpdateProp}
            disabled={!selectedProp || !propValue}
            className="ss-button flex w-full items-center justify-center gap-1 py-1.5 text-xs disabled:opacity-50"
          >
            <Save size={12} /> {t('components.hostPanel.updateProperty')}
          </button>
        </div>

      </div>
      <InitialEventsModal />
    </div>
  );
};

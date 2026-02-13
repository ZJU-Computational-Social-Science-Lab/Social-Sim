
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationStore, fetchEnvironmentSuggestions } from '../store';
import { Megaphone, CloudLightning, Edit, Save, Sparkles, Loader2, Check, FilePlus } from 'lucide-react';
import { MultimodalInput } from './MultimodalInput';
import { InitialEventsModal } from './InitialEventsModal';

export const HostPanel: React.FC = () => {
   const { t } = useTranslation();
  const agents = useSimulationStore(state => state.agents);
  const logs = useSimulationStore(state => state.logs);
  const injectLog = useSimulationStore(state => state.injectLog);
  const updateAgentProperty = useSimulationStore(state => state.updateAgentProperty);
  const addNotification = useSimulationStore(state => state.addNotification);
  const toggleInitialEvents = useSimulationStore((state: any) => state.toggleInitialEvents);

  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [envEvent, setEnvEvent] = useState('');
  const [envImage, setEnvImage] = useState<string | null>(null);
  
  // God Mode State
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || '');
  const [selectedProp, setSelectedProp] = useState('');
  const [propValue, setPropValue] = useState('');

  // #12 Environment Suggestions
  const [suggestions, setSuggestions] = useState<Array<{event: string, reason: string}>>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  const handleBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    injectLog('SYSTEM', `${t('components.hostPanel.logPrefixSystemAnnouncement')} ${broadcastMsg}`);
    setBroadcastMsg('');
  };

  const handleEnvEvent = (text: string = envEvent) => {
    if (!text.trim() && !envImage) return;
    injectLog('ENVIRONMENT', `${t('components.hostPanel.logPrefixEnvironmentEvent')} ${text}`, envImage || undefined);
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
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b bg-amber-50/50">
         <p className="text-xs text-amber-800 leading-relaxed">
           <strong>{t('components.hostPanel.godModeTitle')}</strong>: {t('components.hostPanel.godModeDescription')}
         </p>
         <button
           onClick={() => toggleInitialEvents(true)}
           className="mt-2 text-[11px] px-2 py-1 bg-white border border-amber-200 text-amber-700 rounded flex items-center gap-1"
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
              className="text-[10px] bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 disabled:opacity-50"
            >
              {isSuggesting ? <Loader2 size={10} className="animate-spin inline" /> : t('components.hostPanel.getSuggestions')}
            </button>
          </div>
          
          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="bg-white p-2 rounded border border-indigo-100 text-xs shadow-sm group">
                  <p className="font-bold text-slate-700 mb-1">{s.event}</p>
                  <p className="text-slate-400 text-[10px] mb-2">{s.reason}</p>
                  <button
                    onClick={() => handleAdoptSuggestion(s.event)}
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

        <hr className="border-slate-100" />

        {/* Broadcast */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Megaphone size={14} /> {t('components.hostPanel.systemBroadcast')}
          </label>
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
            className="w-full py-1.5 text-xs bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
          >
            {t('components.hostPanel.sendBroadcast')}
          </button>
        </div>

        <hr className="border-slate-100" />

        {/* Environment with Multimodal Support #24 */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <CloudLightning size={14} /> {t('components.hostPanel.injectEvent')}
          </label>
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

        <hr className="border-slate-100" />

        {/* State Editing */}
        <div className="space-y-3 bg-slate-50 p-3 rounded-lg border">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Edit size={14} /> {t('components.hostPanel.modifyState')}
          </label>

          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setSelectedProp('');
              setPropValue('');
            }}
            className="w-full text-xs border rounded px-2 py-1.5 bg-white"
          >
            {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>

          <select
            value={selectedProp}
            onChange={(e) => setSelectedProp(e.target.value)}
            disabled={!selectedAgent}
            className="w-full text-xs border rounded px-2 py-1.5 bg-white disabled:opacity-50"
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
            className="w-full text-xs border rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100"
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

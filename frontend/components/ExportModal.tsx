
import React, { useState } from 'react';
import { useSimulationStore } from '../store';
import { useTranslation } from 'react-i18next';
import { X, Download, FileJson, FileSpreadsheet, Database, Users } from 'lucide-react';
import Papa from 'papaparse';
import { mapBackendEventsToLogs } from '../store';

export const ExportModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useSimulationStore(state => state.isExportOpen);
  const toggle = useSimulationStore(state => state.toggleExport);
  const logs = useSimulationStore(state => state.logs);
  const rawEvents = useSimulationStore(state => state.rawEvents);
  const agents = useSimulationStore(state => state.agents);
  const currentSim = useSimulationStore(state => state.currentSimulation);
  const nodes = useSimulationStore(state => state.nodes);
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);

  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [scope, setScope] = useState<'all_logs' | 'agent_data'>('all_logs');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    
    // Simulate slight delay for UX
    setTimeout(() => {
      let content = '';
      let mimeType = 'application/json';
      let filename = `${currentSim?.name || 'simulation'}_${scope}_${new Date().toISOString().slice(0,10)}`;

      // 1. Prepare Data
      let dataToExport: any[] | object = [];
      
      if (scope === 'all_logs') {
        // Export uses raw events re-mapped, including all metadata events
        if (rawEvents.length > 0) {
          // Group events by node (if events include node information)
          // Otherwise use selected node's information as default
          const currentNode = nodes.find(n => n.id === selectedNodeId);
          const defaultNodeId = currentNode?.id || selectedNodeId || 'unknown';
          const defaultRound = currentNode?.depth || 0;

          // Re-map all events, including all metadata
          // Note: If event contains node information, extract from event
          const allLogs = mapBackendEventsToLogs(
            rawEvents,
            defaultNodeId,
            defaultRound,
            agents,
            true // Include all metadata when exporting
          );
          dataToExport = allLogs.map(l => ({ ...l, image_preview: l.imageUrl ? `![img](${l.imageUrl})` : '' }));
        } else {
          // If no raw events (standalone mode), use current filtered logs
          dataToExport = logs.map(l => ({ ...l, image_preview: l.imageUrl ? `![img](${l.imageUrl})` : '' }));
        }
      } else {
        dataToExport = agents;
      }

      // 2. Format Data
      if (format === 'json') {
        content = JSON.stringify(dataToExport, null, 2);
        mimeType = 'application/json';
        filename += '.json';
      } else {
        // CSV
        if (scope === 'all_logs') {
          const flat = (dataToExport as any[]).map(l => ({
            timestamp: (l as any).timestamp,
            nodeId: (l as any).nodeId,
            type: (l as any).type,
            agentId: (l as any).agentId,
            content: (l as any).content,
            imageUrl: (l as any).imageUrl,
            image_preview: (l as any).image_preview,
          }));
          content = Papa.unparse(flat);
        } else {
          // For agents, flatten nested objects like properties/history if possible, 
          // or just export basic info for CSV to stay simple
          const flattenedAgents = agents.map(a => ({
            id: a.id,
            name: a.name,
            role: a.role,
            avatarUrl: a.avatarUrl,
            profile: a.profile,
            // Simple stringify for complex objects in CSV
            properties: JSON.stringify(a.properties),
            memory_count: a.memory.length
          }));
          content = Papa.unparse(flattenedAgents);
        }
        mimeType = 'text/csv';
        filename += '.csv';
      }

      // 3. Trigger Download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExporting(false);
      toggle(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Download className="text-brand-600" size={20} />
            {t('components.exportModal.title')}
          </h2>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Scope Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              {t('components.exportModal.selectContent')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setScope('all_logs')}
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all ${scope === 'all_logs' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-slate-50 border-slate-200 text-slate-600'}`}
              >
                <Database size={24} className={scope === 'all_logs' ? 'text-brand-500' : 'text-slate-400'} />
                <span className="text-sm font-medium">{t('components.exportModal.allLogs')}</span>
              </button>
              <button
                onClick={() => setScope('agent_data')}
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all ${scope === 'agent_data' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-slate-50 border-slate-200 text-slate-600'}`}
              >
                <Users size={24} className={scope === 'agent_data' ? 'text-brand-500' : 'text-slate-400'} />
                <span className="text-sm font-medium">{t('components.exportModal.agentData')}</span>
              </button>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              {t('components.exportModal.selectFormat')}
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setFormat('json')}
                className={`flex-1 py-2 px-4 rounded border flex items-center justify-center gap-2 text-sm font-medium transition-all ${format === 'json' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <FileJson size={16} /> {t('components.exportModal.json')}
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 py-2 px-4 rounded border flex items-center justify-center gap-2 text-sm font-medium transition-all ${format === 'csv' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <FileSpreadsheet size={16} /> {t('components.exportModal.excelCsv')}
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 flex gap-2 items-start border">
            <div className="shrink-0 mt-0.5 text-blue-500">ℹ️</div>
            <p>
              {scope === 'all_logs' && format === 'csv' && t('components.exportModal.hintAllLogsCsv')}
              {scope === 'all_logs' && format === 'json' && t('components.exportModal.hintAllLogsJson')}
              {scope === 'agent_data' && format === 'csv' && t('components.exportModal.hintAgentDataCsv')}
              {scope === 'agent_data' && format === 'json' && t('components.exportModal.hintAgentDataJson')}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={() => toggle(false)} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            {t('components.exportModal.cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
          >
            {isExporting ? t('components.exportModal.generating') : t('components.exportModal.confirmExport')}
            {!isExporting && <Download size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

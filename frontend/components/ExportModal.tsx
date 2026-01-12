
import React, { useState } from 'react';
import { useSimulationStore } from '../store';
import { X, Download, FileJson, FileSpreadsheet, Database, Users } from 'lucide-react';
import Papa from 'papaparse';
import { mapBackendEventsToLogs } from '../store';

export const ExportModal: React.FC = () => {
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
        // 导出时使用原始事件重新映射，包含所有元数据事件
        if (rawEvents.length > 0) {
          // 按节点分组处理事件（如果事件包含节点信息）
          // 否则使用当前选中节点的信息作为默认值
          const currentNode = nodes.find(n => n.id === selectedNodeId);
          const defaultNodeId = currentNode?.id || selectedNodeId || 'unknown';
          const defaultRound = currentNode?.depth || 0;
          
          // 重新映射所有事件，包含所有元数据
          // 注意：如果事件本身包含节点信息，可以从事件中提取
          const allLogs = mapBackendEventsToLogs(
            rawEvents,
            defaultNodeId,
            defaultRound,
            agents,
            true // 导出时包含所有元数据
          );
          dataToExport = allLogs;
        } else {
          // 如果没有原始事件（standalone 模式），使用当前过滤后的日志
          dataToExport = logs;
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
          content = Papa.unparse(dataToExport as any[]);
        } else {
          // For agents, flatten nested objects like properties/history if possible, 
          // or just export basic info for CSV to stay simple
          const flattenedAgents = agents.map(a => ({
            id: a.id,
            name: a.name,
            role: a.role,
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
            导出数据
          </h2>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Scope Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              1. 选择导出内容
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setScope('all_logs')}
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all ${scope === 'all_logs' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-slate-50 border-slate-200 text-slate-600'}`}
              >
                <Database size={24} className={scope === 'all_logs' ? 'text-brand-500' : 'text-slate-400'} />
                <span className="text-sm font-medium">完整日志记录</span>
              </button>
              <button 
                onClick={() => setScope('agent_data')}
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all ${scope === 'agent_data' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-slate-50 border-slate-200 text-slate-600'}`}
              >
                <Users size={24} className={scope === 'agent_data' ? 'text-brand-500' : 'text-slate-400'} />
                <span className="text-sm font-medium">智能体画像与状态</span>
              </button>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              2. 选择文件格式
            </label>
            <div className="flex gap-4">
              <button 
                onClick={() => setFormat('json')}
                className={`flex-1 py-2 px-4 rounded border flex items-center justify-center gap-2 text-sm font-medium transition-all ${format === 'json' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <FileJson size={16} /> JSON
              </button>
              <button 
                onClick={() => setFormat('csv')}
                className={`flex-1 py-2 px-4 rounded border flex items-center justify-center gap-2 text-sm font-medium transition-all ${format === 'csv' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <FileSpreadsheet size={16} /> Excel / CSV
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 flex gap-2 items-start border">
            <div className="shrink-0 mt-0.5 text-blue-500">ℹ️</div>
            <p>
              {scope === 'all_logs' && format === 'csv' && "CSV 格式会将日志展平为表格，适合 Excel 分析。"}
              {scope === 'all_logs' && format === 'json' && "JSON 格式保留完整的嵌套结构，适合程序化处理。"}
              {scope === 'agent_data' && format === 'csv' && "CSV 格式仅包含智能体基本信息与扁平化属性。"}
              {scope === 'agent_data' && format === 'json' && "包含智能体完整记忆、历史状态曲线等所有数据。"}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={() => toggle(false)} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            取消
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
          >
            {isExporting ? '生成中...' : '确认导出'}
            {!isExporting && <Download size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

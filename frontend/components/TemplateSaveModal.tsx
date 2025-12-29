
import React, { useState } from 'react';
import { useSimulationStore } from '../store';
import { X, Save, LayoutTemplate } from 'lucide-react';

export const TemplateSaveModal: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isSaveTemplateOpen);
  const toggle = useSimulationStore(state => state.toggleSaveTemplate);
  const saveTemplate = useSimulationStore(state => state.saveTemplate);
  const currentSim = useSimulationStore(state => state.currentSimulation);
  const agents = useSimulationStore(state => state.agents);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name) return;
    saveTemplate(name, description);
    setName('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <LayoutTemplate className="text-brand-600" size={20} />
            保存为模板
          </h2>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 mb-4">
            当前包含 <strong>{agents.length}</strong> 个智能体、当前时间配置以及场景逻辑将被保存。
            历史运行日志不会被保存。
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              模板名称
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：高信任度乡村配置"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              描述 (可选)
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述此模板的适用场景或特殊配置..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm h-24 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={() => toggle(false)} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={!name}
            className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            保存模板
          </button>
        </div>
      </div>
    </div>
  );
};

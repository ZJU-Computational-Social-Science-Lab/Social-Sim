
import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../store';
import { X, Clock } from 'lucide-react';
import { TimeUnit } from '../types';

const TIME_UNITS: {value: TimeUnit, label: string}[] = [
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' },
  { value: 'day', label: '天' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

export const TimeSettingsModal: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isTimeSettingsOpen);
  const toggle = useSimulationStore(state => state.toggleTimeSettings);
  const currentSim = useSimulationStore(state => state.currentSimulation);
  const updateTimeConfig = useSimulationStore(state => state.updateTimeConfig);

  const [step, setStep] = useState(1);
  const [unit, setUnit] = useState<TimeUnit>('hour');
  const [baseTime, setBaseTime] = useState('');

  useEffect(() => {
    if (currentSim && isOpen) {
      setStep(currentSim.timeConfig.step);
      setUnit(currentSim.timeConfig.unit);
      setBaseTime(new Date(currentSim.timeConfig.baseTime).toISOString().slice(0, 16));
    }
  }, [currentSim, isOpen]);

  if (!isOpen || !currentSim) return null;

  const handleSave = () => {
    updateTimeConfig({
      baseTime: new Date(baseTime).toISOString(),
      step,
      unit
    });
    toggle(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="text-brand-600" size={20} />
            时间流速设置
          </h2>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 mb-4">
            调整仿真推进时的时间跨度。修改将在下一回合生效，不会影响历史记录。
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              每回合推进
            </label>
            <div className="flex gap-2">
              <input 
                type="number" 
                min="1"
                value={step}
                onChange={(e) => setStep(Math.max(1, parseInt(e.target.value)))}
                className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm text-center font-bold"
              />
              <select 
                value={unit}
                onChange={(e) => setUnit(e.target.value as TimeUnit)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white"
              >
                {TIME_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
               校准起始时间 (慎用)
            </label>
            <input 
              type="datetime-local" 
              value={baseTime}
              onChange={(e) => setBaseTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm text-slate-600"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={() => toggle(false)} className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm"
          >
            应用设置
          </button>
        </div>
      </div>
    </div>
  );
};

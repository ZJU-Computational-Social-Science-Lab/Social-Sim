
import React, { useState } from 'react';
import { AgentPanel } from './AgentPanel';
import { HostPanel } from './HostPanel';
import { Users, Zap } from 'lucide-react';
import { useSimulationStore } from '../store';

export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'host'>('agents');
  const agents = useSimulationStore(state => state.agents);

  return (
    <div className="h-full flex flex-col bg-white border-l shadow-sm w-80">
      {/* Tab Header */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${
            activeTab === 'agents' 
              ? 'text-brand-600 border-brand-600 bg-brand-50/50' 
              : 'text-slate-500 border-transparent hover:bg-slate-50'
          }`}
        >
          <Users size={14} /> 智能体 ({agents.length})
        </button>
        <button
          onClick={() => setActiveTab('host')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${
            activeTab === 'host' 
              ? 'text-amber-600 border-amber-600 bg-amber-50/50' 
              : 'text-slate-500 border-transparent hover:bg-slate-50'
          }`}
        >
          <Zap size={14} /> 主持控制
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'agents' ? <AgentPanel /> : <HostPanel />}
      </div>
    </div>
  );
};


import React, { useState, useRef } from 'react';
import { useSimulationStore } from '../store';
import { User, Brain, Activity, ChevronDown, ChevronRight, Bot, BookOpen, Plus, FileText, Trash2 } from 'lucide-react';
import { Agent, KnowledgeItem } from '../types';

const AgentCard: React.FC<{ agent: Agent }> = ({ agent }) => {
  const [isMemoryOpen, setIsMemoryOpen] = useState(true);
  const [isPropsOpen, setIsPropsOpen] = useState(false);
  const [isKBOpen, setIsKBOpen] = useState(false); // #23
  
  const addKnowledgeToAgent = useSimulationStore(state => state.addKnowledgeToAgent);
  const removeKnowledgeFromAgent = useSimulationStore(state => state.removeKnowledgeFromAgent);
  
  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbContent, setNewKbContent] = useState('');
  const [isAddingKB, setIsAddingKB] = useState(false);

  // Helper to color code models
  const getModelBadgeStyle = (provider: string) => {
    switch(provider.toLowerCase()) {
      case 'openai': return 'bg-green-50 text-green-700 border-green-200';
      case 'anthropic': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'google': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const handleAddKB = () => {
    if (!newKbTitle || !newKbContent) return;
    const item: KnowledgeItem = {
      id: `kb-${Date.now()}`,
      title: newKbTitle,
      type: 'text',
      content: newKbContent,
      enabled: true,
      timestamp: new Date().toISOString()
    };
    addKnowledgeToAgent(agent.id, item);
    setNewKbTitle('');
    setNewKbContent('');
    setIsAddingKB(false);
  };

  return (
    <div className="bg-white border-b last:border-b-0">
      {/* Sticky Profile Header (#6) */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-4 flex gap-3 items-start">
        <img 
          src={agent.avatarUrl} 
          alt={agent.name} 
          className="w-12 h-12 rounded-full border border-slate-200 object-cover" 
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 truncate">{agent.name}</h4>
            {/* #10 Model Badge */}
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${getModelBadgeStyle(agent.llmConfig?.provider || 'default')}`} title={`Model: ${agent.llmConfig?.model}`}>
              <Bot size={10} />
              <span className="font-mono">{agent.llmConfig?.model || 'Auto'}</span>
            </div>
          </div>
          <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full border border-slate-200">
            {agent.role}
          </span>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            {agent.profile}
          </p>
        </div>
      </div>

      {/* Attributes Comparison Section (#6 contrast view placeholder) */}
      <div className="p-0">
        <button 
          onClick={() => setIsPropsOpen(!isPropsOpen)}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Activity size={14} />
            <span>当前状态属性</span>
          </div>
          {isPropsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        
        {isPropsOpen && (
          <div className="p-4 grid grid-cols-2 gap-2">
            {Object.entries(agent.properties).map(([key, value]) => (
              <div key={key} className="flex flex-col p-2 bg-slate-50 rounded border">
                <span className="text-[10px] uppercase text-slate-400 font-bold">{key}</span>
                <span className="text-sm font-mono font-medium text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Base (#23) */}
      <div className="p-0 border-t">
        <button 
          onClick={() => setIsKBOpen(!isKBOpen)}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <BookOpen size={14} />
            <span>知识库 (RAG) ({agent.knowledgeBase.length})</span>
          </div>
          {isKBOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        
        {isKBOpen && (
          <div className="p-4 bg-slate-50/50 space-y-3">
             {agent.knowledgeBase.length === 0 && !isAddingKB && (
               <div className="text-center py-2 text-slate-400 text-xs italic">暂无知识库文档</div>
             )}
             
             {agent.knowledgeBase.map(kb => (
               <div key={kb.id} className="bg-white border rounded p-2 text-xs relative group">
                  <div className="flex items-center gap-2 font-bold text-slate-700 mb-1">
                     <FileText size={12} className="text-blue-500" />
                     {kb.title}
                  </div>
                  <p className="text-slate-500 line-clamp-2">{kb.content}</p>
                  <button 
                     onClick={() => removeKnowledgeFromAgent(agent.id, kb.id)}
                     className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                     <Trash2 size={12} />
                  </button>
               </div>
             ))}

             {isAddingKB ? (
                <div className="bg-white border border-brand-200 rounded p-2 text-xs space-y-2">
                   <input 
                     type="text" 
                     placeholder="标题 (如: 乡村公约)"
                     value={newKbTitle} 
                     onChange={(e) => setNewKbTitle(e.target.value)}
                     className="w-full p-1 border rounded outline-none focus:ring-1 focus:ring-brand-500"
                   />
                   <textarea 
                     placeholder="知识内容..."
                     value={newKbContent}
                     onChange={(e) => setNewKbContent(e.target.value)}
                     className="w-full p-1 border rounded outline-none focus:ring-1 focus:ring-brand-500 h-16 resize-none"
                   />
                   <div className="flex gap-2">
                      <button onClick={handleAddKB} className="flex-1 py-1 bg-brand-600 text-white rounded hover:bg-brand-700">保存</button>
                      <button onClick={() => setIsAddingKB(false)} className="flex-1 py-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">取消</button>
                   </div>
                </div>
             ) : (
                <button 
                   onClick={() => setIsAddingKB(true)}
                   className="w-full py-1.5 border border-dashed border-slate-300 text-slate-500 hover:border-brand-500 hover:text-brand-600 rounded text-xs flex items-center justify-center gap-1 transition-colors"
                >
                   <Plus size={12} /> 添加知识条目
                </button>
             )}
          </div>
        )}
      </div>

      {/* Collapsible Memory (#6) */}
      <div className="p-0 border-t">
        <button 
          onClick={() => setIsMemoryOpen(!isMemoryOpen)}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Brain size={14} />
            <span>短期记忆 ({agent.memory.length})</span>
          </div>
          {isMemoryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {isMemoryOpen && (
          <div className="max-h-64 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {agent.memory.map((mem) => (
              <div key={mem.id} className="text-xs relative pl-3 border-l-2 border-slate-300">
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span className="uppercase text-[10px] font-bold tracking-wider">{mem.type}</span>
                  <span className="font-mono text-[10px]">{mem.timestamp}</span>
                </div>
                <p className={`leading-relaxed ${mem.type === 'thought' ? 'text-slate-500 italic' : 'text-slate-700'}`}>
                  {mem.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const AgentPanel: React.FC = () => {
  const agents = useSimulationStore(state => state.agents);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
};

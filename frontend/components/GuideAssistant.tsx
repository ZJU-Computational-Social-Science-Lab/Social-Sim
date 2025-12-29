
import React, { useRef, useEffect, useState } from 'react';
import { useSimulationStore } from '../store';
import { MessageSquare, X, Send, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { GuideActionType } from '../types';

export const GuideAssistant: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isGuideOpen);
  const toggle = useSimulationStore(state => state.toggleGuide);
  const messages = useSimulationStore(state => state.guideMessages);
  const isGuideLoading = useSimulationStore(state => state.isGuideLoading);
  const sendGuideMessage = useSimulationStore(state => state.sendGuideMessage);
  
  // UI Triggers
  const toggleWizard = useSimulationStore(state => state.toggleWizard);
  const toggleNetworkEditor = useSimulationStore(state => state.toggleNetworkEditor);
  const toggleExperimentDesigner = useSimulationStore(state => state.toggleExperimentDesigner);
  const toggleExport = useSimulationStore(state => state.toggleExport);
  const toggleAnalytics = useSimulationStore(state => state.toggleAnalytics);
  // Host Panel logic is part of Sidebar, we can't toggle it directly from store easily without a dedicated state, 
  // but we can assume user knows where it is or add a notification/hint. 
  // *Correction*: We can just highlight or guide user. 
  // However, for this implementation, let's focus on the toggleable modals.

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim() || isGuideLoading) return;
    sendGuideMessage(input);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const executeAction = (action: GuideActionType) => {
     switch(action) {
        case 'OPEN_WIZARD': toggleWizard(true); break;
        case 'OPEN_NETWORK': toggleNetworkEditor(true); break;
        case 'OPEN_EXPERIMENT': toggleExperimentDesigner(true); break;
        case 'OPEN_EXPORT': toggleExport(true); break;
        case 'OPEN_ANALYTICS': toggleAnalytics(true); break;
        case 'OPEN_HOST': 
           // Sidebar tab switching is local state in Sidebar.tsx. 
           // In a full app, we would move activeTab to global store. 
           // For now, we'll just show a hint.
           alert("请查看右侧边栏的“主持控制”标签页。");
           break;
     }
  };

  const getActionLabel = (action: GuideActionType) => {
     switch(action) {
        case 'OPEN_WIZARD': return '打开新建仿真向导';
        case 'OPEN_NETWORK': return '打开社交网络编辑器';
        case 'OPEN_EXPERIMENT': return '打开实验设计器';
        case 'OPEN_EXPORT': return '打开导出面板';
        case 'OPEN_ANALYTICS': return '查看统计分析';
        case 'OPEN_HOST': return '前往主持控制台';
        default: return '执行操作';
     }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => toggle(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 group"
      >
        <Sparkles size={20} className="group-hover:animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-10 fade-in duration-300">
      
      {/* Header */}
      <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <h3 className="font-bold text-sm">平台指引助手 (Guide)</h3>
        </div>
        <button onClick={() => toggle(false)} className="text-indigo-200 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
               msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
            }`}>
               <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            
            {/* Action Chips (#15 Workflow) */}
            {msg.suggestedActions && msg.suggestedActions.length > 0 && (
               <div className="mt-2 flex flex-wrap gap-2">
                  {msg.suggestedActions.map(action => (
                     <button 
                        key={action}
                        onClick={() => executeAction(action)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200 transition-colors"
                     >
                        {getActionLabel(action)}
                        <ArrowRight size={12} />
                     </button>
                  ))}
               </div>
            )}
          </div>
        ))}
        {isGuideLoading && (
           <div className="flex justify-start">
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border shadow-sm">
                 <Loader2 size={16} className="animate-spin text-indigo-500" />
              </div>
           </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t shrink-0">
         <div className="relative">
            <input 
               type="text" 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={handleKeyPress}
               placeholder="你想了解什么功能..."
               className="w-full pl-4 pr-10 py-3 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm outline-none transition-all"
               autoFocus
            />
            <button 
               onClick={handleSend}
               disabled={!input.trim() || isGuideLoading}
               className="absolute right-2 top-2 p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent"
            >
               <Send size={18} />
            </button>
         </div>
         <p className="text-[10px] text-center text-slate-400 mt-2">
            AI 可能会犯错。请核对重要信息。
         </p>
      </div>
    </div>
  );
};

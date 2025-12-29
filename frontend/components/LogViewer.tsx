
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store';
import { LogEntry, ViewMode, SimNode } from '../types';
import { List, CreditCard, Clock, Filter, Search, X, Check, GitCommit, Image as ImageIcon } from 'lucide-react';

// Helper for displaying time niceliy
const formatLogTime = (dateStr: string) => {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  // E.g. "Mar 10, 14:00"
  return date.toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const LogItem: React.FC<{ entry: LogEntry; mode: ViewMode; nodeWorldTime?: string }> = ({ entry, mode, nodeWorldTime }) => {
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const getBorderColor = () => {
    switch (entry.type) {
      case 'SYSTEM': return 'border-l-slate-400';
      case 'AGENT_SAY': return 'border-l-blue-500';
      case 'AGENT_ACTION': return 'border-l-amber-500';
      case 'ENVIRONMENT': return 'border-l-emerald-500';
      default: return 'border-l-slate-200';
    }
  };

  const getBadgeColor = () => {
    switch (entry.type) {
      case 'SYSTEM': return 'bg-slate-100 text-slate-600';
      case 'AGENT_SAY': return 'bg-blue-50 text-blue-600';
      case 'AGENT_ACTION': return 'bg-amber-50 text-amber-600';
      case 'ENVIRONMENT': return 'bg-emerald-50 text-emerald-600';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const translateType = (type: string) => {
    switch(type) {
      case 'SYSTEM': return '系统';
      case 'AGENT_SAY': return '对话';
      case 'AGENT_ACTION': return '行动';
      case 'ENVIRONMENT': return '环境';
      default: return type;
    }
  };

  // Use entry timestamp if valid, otherwise fallback or node time
  const displayTime = entry.timestamp.includes('-') ? formatLogTime(entry.timestamp) : entry.timestamp;

  const ImageComponent = () => (
    entry.imageUrl ? (
      <div className="mt-2">
        <div 
          className="relative group cursor-pointer w-fit"
          onClick={() => setIsImageExpanded(true)}
        >
          <img 
            src={entry.imageUrl} 
            alt="Log Attachment" 
            className="max-h-48 rounded border border-slate-200 object-cover"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
             <ImageIcon className="text-white drop-shadow-md" size={24} />
          </div>
        </div>
        
        {/* Simple Lightbox */}
        {isImageExpanded && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={(e) => {
             e.stopPropagation();
             setIsImageExpanded(false);
          }}>
             <img src={entry.imageUrl} alt="Full Size" className="max-w-full max-h-full rounded shadow-2xl" />
             <button className="absolute top-4 right-4 text-white hover:text-slate-300">
               <X size={32} />
             </button>
          </div>
        )}
      </div>
    ) : null
  );

  if (mode === ViewMode.LIST) {
    return (
      <div className={`py-2 px-4 border-b hover:bg-slate-50 text-sm flex gap-4 ${entry.type === 'SYSTEM' ? 'bg-slate-50/50' : ''}`}>
        <span className="font-mono text-slate-400 text-xs w-24 shrink-0 whitespace-nowrap">{displayTime}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase self-start whitespace-nowrap ${getBadgeColor()}`}>
          {translateType(entry.type)}
        </span>
        <div className="flex-1">
          {entry.agentId && <span className="font-bold text-slate-700 mr-2">{entry.agentId}:</span>}
          <span className="text-slate-600">{entry.content}</span>
          <ImageComponent />
        </div>
      </div>
    );
  }

  // Card & Timeline Views
  return (
    <div className={`mb-3 p-3 bg-white border rounded shadow-sm relative ${getBorderColor()} border-l-4 hover:shadow-md transition-shadow`}>
       {mode === ViewMode.TIMELINE && (
         <div className="absolute -left-[29px] top-4 w-3 h-3 rounded-full bg-slate-300 border-2 border-slate-50 z-10"></div>
       )}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
           <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getBadgeColor()}`}>
            {translateType(entry.type)}
          </span>
          {entry.agentId && <span className="text-xs font-bold text-slate-800">{entry.agentId}</span>}
        </div>
        <span className="text-[10px] font-mono text-slate-400">{displayTime}</span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{entry.content}</p>
      <ImageComponent />
    </div>
  );
};

export const LogViewer: React.FC = () => {
  const logs = useSimulationStore(state => state.logs);
  const nodes = useSimulationStore(state => state.nodes);
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
  const agents = useSimulationStore(state => state.agents);
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CARD);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute Ancestry Path for current selection
  const ancestorIds = useMemo(() => {
    const ids = new Set<string>();
    let current = nodes.find(n => n.id === selectedNodeId);
    while (current) {
      ids.add(current.id);
      current = nodes.find(n => n.id === current.parentId);
    }
    return ids;
  }, [nodes, selectedNodeId]);

  // Filter Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 0. Ancestry Filter (Strict: only show logs from current path)
      if (log.nodeId && !ancestorIds.has(log.nodeId)) {
        return false;
      }

      // 1. Search Text
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const contentMatch = log.content.toLowerCase().includes(query);
        const agentMatch = log.agentId?.toLowerCase().includes(query);
        const typeMatch = log.type.toLowerCase().includes(query);
        if (!contentMatch && !agentMatch && !typeMatch) return false;
      }

      // 2. Filter by Type
      if (selectedTypes.length > 0 && !selectedTypes.includes(log.type)) {
        return false;
      }

      // 3. Filter by Agent
      if (selectedAgents.length > 0) {
        if (!log.agentId || !selectedAgents.includes(log.agentId)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchQuery, selectedTypes, selectedAgents, ancestorIds]);

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, selectedNodeId]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedAgents([]);
  };

  const hasActiveFilters = searchQuery || selectedTypes.length > 0 || selectedAgents.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 border rounded-lg overflow-hidden relative">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-2 flex flex-col gap-2 shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border">
            <button 
              onClick={() => setViewMode(ViewMode.LIST)}
              className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.LIST ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              title="列表视图"
            >
              <List size={16} />
            </button>
            <button 
               onClick={() => setViewMode(ViewMode.CARD)}
               className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.CARD ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
               title="卡片视图"
            >
              <CreditCard size={16} />
            </button>
             <button 
               onClick={() => setViewMode(ViewMode.TIMELINE)}
               className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.TIMELINE ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
               title="时间轴视图"
            >
              <Clock size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 border px-2 py-1 rounded">
               <GitCommit size={12} />
               <span>当前分支路径过滤</span>
            </div>
            
            <div className="relative max-w-[180px] w-full">
              <input 
                type="text" 
                placeholder="搜索日志..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
              <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>

            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded transition-colors ${isFilterOpen || (hasActiveFilters && !searchQuery) ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">筛选</span>
              {(selectedTypes.length > 0 || selectedAgents.length > 0) && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] text-white">
                  {selectedTypes.length + selectedAgents.length}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Filter Panel */}
        {isFilterOpen && (
          <div className="pt-2 pb-3 border-t mt-1 space-y-3 animate-in slide-in-from-top-2 duration-200">
             <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">事件类型</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'SYSTEM', label: '系统' },
                  { id: 'AGENT_SAY', label: '对话' },
                  { id: 'AGENT_ACTION', label: '行动' },
                  { id: 'ENVIRONMENT', label: '环境' },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`px-2 py-1 rounded text-xs border flex items-center gap-1.5 transition-all ${
                      selectedTypes.includes(type.id) 
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {selectedTypes.includes(type.id) && <Check size={10} />}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Agents */}
            {agents.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">相关智能体</div>
                <div className="flex flex-wrap gap-2">
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1.5 transition-all pl-1 ${
                        selectedAgents.includes(agent.id) 
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img src={agent.avatarUrl} alt="" className="w-4 h-4 rounded-full bg-slate-100" />
                      {agent.name}
                      {selectedAgents.includes(agent.id) && <Check size={10} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end pt-2">
              <button 
                onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-slate-600 underline decoration-slate-300 underline-offset-2"
              >
                清空所有筛选
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 scroll-smooth ${viewMode === ViewMode.TIMELINE ? 'pl-10' : ''}`}>
        {viewMode === ViewMode.TIMELINE && filteredLogs.length > 0 && (
           <div className="absolute left-[36px] top-0 bottom-0 w-0.5 bg-slate-200 -z-0"></div>
        )}
        
        {filteredLogs.length > 0 ? (
          filteredLogs.map(log => {
             // Find corresponding node worldTime if available (optional enhancement)
             const node = nodes.find(n => n.id === log.nodeId);
             return (
               <LogItem key={log.id} entry={log} mode={viewMode} nodeWorldTime={node?.worldTime} />
             );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <Search size={32} className="mb-2 opacity-20" />
            <p className="text-sm">没有找到匹配的日志</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs text-brand-600 hover:underline">
                清除筛选条件
              </button>
            )}
            {!hasActiveFilters && (
               <p className="text-xs mt-1 text-slate-300">此节点下暂无活动记录</p>
            )}
          </div>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="bg-slate-50 border-t px-3 py-1 text-[10px] text-slate-400 flex justify-between">
        <span>显示 {filteredLogs.length} 条记录 (当前分支)</span>
        {hasActiveFilters && <span>筛选已生效</span>}
      </div>
    </div>
  );
};

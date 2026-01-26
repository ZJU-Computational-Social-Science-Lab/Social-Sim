
import React, { useState, useMemo } from 'react';
const renderProfileHtml = (text: string) => {
  const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escaped = escape(text || '');
  const withImages = escaped.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    const safeAlt = escape(alt || 'image');
    const safeUrl = url.replace(/"/g, '&quot;');
    return `<img src="${safeUrl}" alt="${safeAlt}" class="inline-block max-h-32 rounded border border-slate-200 mr-2 mb-2" />`;
  });
  return withImages.replace(/\n/g, '<br />');
};
import { useSimulationStore } from '../store';
import { User, Brain, Activity, ChevronDown, ChevronRight, Bot, BookOpen, Plus, FileText, Trash2, Edit3, Save, X } from 'lucide-react';
import { Agent, KnowledgeItem } from '../types';
import { MultimodalInput } from './MultimodalInput';

const extractMarkdownImages = (text: string): string[] => {
  const matches = Array.from(text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g));
  return matches.map((m) => m[1]).filter(Boolean);
};

const AgentCard: React.FC<{ agent: Agent }> = ({ agent }) => {
  const [isMemoryOpen, setIsMemoryOpen] = useState(true);
  const [isPropsOpen, setIsPropsOpen] = useState(false);
  const [isKBOpen, setIsKBOpen] = useState(false); // #23
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState(agent.profile);
  
  const addKnowledgeToAgent = useSimulationStore(state => state.addKnowledgeToAgent);
  const removeKnowledgeFromAgent = useSimulationStore(state => state.removeKnowledgeFromAgent);
  const updateAgentProfile = useSimulationStore(state => state.updateAgentProfile);
  const addNotification = useSimulationStore(state => state.addNotification);
  
  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbContent, setNewKbContent] = useState('');
  const [isAddingKB, setIsAddingKB] = useState(false);
  const imageUrls = useMemo(() => extractMarkdownImages(newKbContent), [newKbContent]);

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
          {isProfileEditing ? (
            <div className="space-y-2 mt-2">
              <textarea
                value={profileDraft}
                onChange={(e) => setProfileDraft(e.target.value)}
                className="w-full text-xs border rounded p-2 focus:ring-1 focus:ring-brand-500 outline-none min-h-[80px]"
              />
              <MultimodalInput
                helperText="拖拽/上传图片将以 markdown 链接插入画像描述"
                onInsert={(url) => setProfileDraft((prev) => `${prev}${prev ? '\n' : ''}![image](${url})`)}
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 py-1.5 bg-brand-600 text-white rounded text-xs flex items-center justify-center gap-1"
                  onClick={() => {
                    updateAgentProfile(agent.id, profileDraft);
                    setIsProfileEditing(false);
                  }}
                >
                  <Save size={12} /> 保存画像
                </button>
                <button
                  className="flex-1 py-1.5 bg-slate-200 text-slate-600 rounded text-xs flex items-center justify-center gap-1"
                  onClick={() => {
                    setProfileDraft(agent.profile);
                    setIsProfileEditing(false);
                  }}
                >
                  <X size={12} /> 取消
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-start gap-2">
              <div className="text-xs text-slate-500 leading-relaxed flex-1 markdown-body">
                  <div
                    className="text-xs text-slate-500 leading-relaxed flex-1 markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderProfileHtml(agent.profile) }}
                  >
                  </div>
              </div>
              <button
                className="text-slate-400 hover:text-brand-600"
                onClick={() => setIsProfileEditing(true)}
                title="编辑画像"
              >
                <Edit3 size={14} />
              </button>
            </div>
          )}
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
                   <div className="flex items-center justify-between text-[11px] text-slate-500">
                     <span>支持插入 markdown 图片</span>
                     <MultimodalInput
                       helperText="拖拽或上传图片后自动插入 markdown 链接"
                       onInsert={(url) => {
                         setNewKbContent((prev) => `${prev}${prev ? '\n' : ''}![image](${url})`);
                         addNotification('success', '图片已插入');
                       }}
                     />
                   </div>
                   {imageUrls.length > 0 && (
                     <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                       {imageUrls.map((url) => (
                         <div key={url} className="w-16 h-16 border rounded overflow-hidden bg-slate-50">
                           <img src={url} alt="preview" className="w-full h-full object-cover" />
                         </div>
                       ))}
                     </div>
                   )}
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


import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationStore } from '../store';
import { User, Brain, Activity, ChevronDown, ChevronRight, Bot, BookOpen, Plus, FileText, Trash2, Upload, File, Loader2, Edit3, Save, X } from 'lucide-react';
import { Agent, KnowledgeItem } from '../types';
import { uploadAgentDocument, listAgentDocuments, deleteAgentDocument, DocumentInfo } from '../services/simulations';
import { MultimodalInput } from './MultimodalInput';

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

const AgentCard: React.FC<{ agent: Agent }> = ({ agent }) => {
  const { t } = useTranslation();
  const [isMemoryOpen, setIsMemoryOpen] = useState(true);
  const [isPropsOpen, setIsPropsOpen] = useState(false);
  const [isKBOpen, setIsKBOpen] = useState(false); // #23
  const [isDocsOpen, setIsDocsOpen] = useState(false); // Documents section

  const addKnowledgeToAgent = useSimulationStore(state => state.addKnowledgeToAgent);
  const removeKnowledgeFromAgent = useSimulationStore(state => state.removeKnowledgeFromAgent);
  const updateKnowledgeInAgent = useSimulationStore(state => state.updateKnowledgeInAgent);
  const updateAgentProfile = useSimulationStore(state => state.updateAgentProfile);
  const addNotification = useSimulationStore(state => state.addNotification);
  const simulationId = useSimulationStore(state => state.currentSimulation?.id);
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);

  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbContent, setNewKbContent] = useState('');
  const [isAddingKB, setIsAddingKB] = useState(false);

  // Edit state for knowledge items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Profile editing state
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState(agent.profile);

  // Document upload state
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents when docs section is opened
  const loadDocuments = useCallback(async () => {
    if (!simulationId) return;
    try {
      // Pass selectedNodeId to fetch documents from the correct tree node
      const docs = await listAgentDocuments(simulationId, agent.name, selectedNodeId ?? undefined);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, [simulationId, agent.name, selectedNodeId]);

  // Auto-load documents when node changes to keep count accurate
  useEffect(() => {
    if (simulationId) {
      loadDocuments();
    }
  }, [simulationId, selectedNodeId, agent.name, loadDocuments]);

  const handleDocsToggle = () => {
    const newState = !isDocsOpen;
    setIsDocsOpen(newState);
    if (newState) {
      loadDocuments();
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!simulationId) {
      setUploadError(t('components.agentPanel.noSimulationId'));
      return;
    }

    // Validate file type
    const allowedTypes = ['.pdf', '.txt', '.docx', '.md'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      setUploadError(t('components.agentPanel.invalidFileType', { types: allowedTypes.join(', ') }));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(t('components.agentPanel.fileTooLarge'));
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      console.log(`INFO: Upload started - agent=${agent.name}, file=${file.name}`);
      const result = await uploadAgentDocument(simulationId, agent.name, file);
      console.log(`INFO: Upload complete - doc_id=${result.doc_id}, chunks=${result.chunks_count}`);
      loadDocuments(); // Refresh the list
    } catch (err: any) {
      console.error('ERROR: Upload failed -', err);
      setUploadError(err.message || t('components.agentPanel.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete document
  const handleDeleteDocument = async (docId: string) => {
    if (!simulationId) return;
    try {
      await deleteAgentDocument(simulationId, agent.name, docId);
      loadDocuments();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

  // Edit handlers for knowledge items
  const handleStartEdit = (kb: KnowledgeItem) => {
    setEditingItemId(kb.id);
    setEditTitle(kb.title);
    setEditContent(kb.content);
  };

  const handleSaveEdit = () => {
    if (!editingItemId || !editTitle.trim()) return;
    updateKnowledgeInAgent(agent.id, editingItemId, {
      title: editTitle,
      content: editContent,
      timestamp: new Date().toISOString()
    });
    setEditingItemId(null);
    setEditTitle('');
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditTitle('');
    setEditContent('');
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
                helperText={t('components.agentPanel.uploadHelperText')}
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
                  <Save size={12} /> {t('components.agentPanel.saveProfile')}
                </button>
                <button
                  className="flex-1 py-1.5 bg-slate-200 text-slate-600 rounded text-xs flex items-center justify-center gap-1"
                  onClick={() => {
                    setProfileDraft(agent.profile);
                    setIsProfileEditing(false);
                  }}
                >
                  <X size={12} /> {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-start gap-2">
              <div
                className="text-xs text-slate-500 leading-relaxed flex-1 markdown-body"
                dangerouslySetInnerHTML={{ __html: renderProfileHtml(agent.profile) }}
              />
              <button
                className="text-slate-400 hover:text-brand-600"
                onClick={() => setIsProfileEditing(true)}
                title={t('components.agentPanel.editProfile')}
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
            <span>{t('components.agentPanel.currentAttributes')}</span>
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
            <span>{t('components.agentPanel.knowledgeBase')} ({agent.knowledgeBase.length})</span>
          </div>
          {isKBOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        
        {isKBOpen && (
          <div className="p-4 bg-slate-50/50 space-y-3">
             {agent.knowledgeBase.length === 0 && !isAddingKB && (
               <div className="text-center py-2 text-slate-400 text-xs italic">{t('components.agentPanel.noKnowledgeDocs')}</div>
             )}
             
             {agent.knowledgeBase.map(kb => {
               const isEditing = editingItemId === kb.id;
               return (
                 <div key={kb.id} className="bg-white border rounded p-2 text-xs relative group">
                   {isEditing ? (
                     // Edit mode
                     <div className="space-y-2">
                       <input
                         type="text"
                         value={editTitle}
                         onChange={(e) => setEditTitle(e.target.value)}
                         className="w-full p-1 border rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
                         placeholder={t('components.agentPanel.title')}
                       />
                       <textarea
                         value={editContent}
                         onChange={(e) => setEditContent(e.target.value)}
                         className="w-full p-1 border rounded text-xs h-20 resize-none outline-none focus:ring-1 focus:ring-brand-500"
                         placeholder={t('components.agentPanel.knowledgeContent')}
                       />
                       <div className="flex gap-2 justify-end">
                         <button
                           onClick={handleSaveEdit}
                           disabled={!editTitle.trim()}
                           className="px-2 py-1 text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           {t('components.agentPanel.save')}
                         </button>
                         <button
                           onClick={handleCancelEdit}
                           className="px-2 py-1 text-slate-500 hover:text-slate-600"
                         >
                           {t('common.cancel')}
                         </button>
                       </div>
                     </div>
                   ) : (
                     // View mode
                     <>
                       <div className="flex items-center gap-2 font-bold text-slate-700 mb-1">
                         <FileText size={12} className="text-blue-500" />
                         {kb.title}
                       </div>
                       <p className="text-slate-500 line-clamp-2">{kb.content}</p>
                       <div className="flex gap-2 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button
                           onClick={() => handleStartEdit(kb)}
                           className="text-slate-400 hover:text-blue-500"
                           title={t('components.agentPanel.edit')}
                         >
                           ✏️
                         </button>
                         <button
                           onClick={() => removeKnowledgeFromAgent(agent.id, kb.id)}
                           className="text-slate-400 hover:text-red-500"
                           title={t('components.agentPanel.delete')}
                         >
                           🗑️
                         </button>
                       </div>
                     </>
                   )}
                 </div>
               );
             })}

             {isAddingKB ? (
                <div className="bg-white border border-brand-200 rounded p-2 text-xs space-y-2">
                   <input
                     type="text"
                     placeholder={t('components.agentPanel.titlePlaceholder')}
                     value={newKbTitle}
                     onChange={(e) => setNewKbTitle(e.target.value)}
                     className="w-full p-1 border rounded outline-none focus:ring-1 focus:ring-brand-500"
                   />
                   <textarea
                     placeholder={t('components.agentPanel.knowledgeContent')}
                     value={newKbContent}
                     onChange={(e) => setNewKbContent(e.target.value)}
                     className="w-full p-1 border rounded outline-none focus:ring-1 focus:ring-brand-500 h-16 resize-none"
                   />
                   <div className="flex gap-2">
                      <button onClick={handleAddKB} className="flex-1 py-1 bg-brand-600 text-white rounded hover:bg-brand-700">{t('components.agentPanel.save')}</button>
                      <button onClick={() => setIsAddingKB(false)} className="flex-1 py-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">{t('common.cancel')}</button>
                   </div>
                </div>
             ) : (
                <button
                   onClick={() => setIsAddingKB(true)}
                   className="w-full py-1.5 border border-dashed border-slate-300 text-slate-500 hover:border-brand-500 hover:text-brand-600 rounded text-xs flex items-center justify-center gap-1 transition-colors"
                >
                   <Plus size={12} /> {t('components.agentPanel.addKnowledge')}
                </button>
             )}
          </div>
        )}
      </div>

      {/* Documents Section (Embedded RAG) */}
      <div className="p-0 border-t">
        <button
          onClick={handleDocsToggle}
          className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Upload size={14} />
            <span>{t('components.agentPanel.documentKnowledgeBase')} ({documents.length})</span>
          </div>
          {isDocsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {isDocsOpen && (
          <div className="p-4 bg-slate-50/50 space-y-3">
            {/* Upload area */}
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                isDragging
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-300 hover:border-brand-400'
              } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx,.md"
                onChange={handleFileInput}
                className="hidden"
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex items-center justify-center gap-2 text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs">{t('components.agentPanel.uploading')}</span>
                </div>
              ) : (
                <>
                  <Upload size={20} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500">
                    {t('components.agentPanel.dragDropUpload')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('components.agentPanel.supportedFormats')}
                  </p>
                </>
              )}
            </div>

            {/* Error message */}
            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600">
                {uploadError}
              </div>
            )}

            {/* Uploaded documents list */}
            {documents.length === 0 && !isUploading && (
              <div className="text-center py-2 text-slate-400 text-xs italic">
                {t('components.agentPanel.noUploadedDocs')}
              </div>
            )}

            {documents.map(doc => (
              <div key={doc.id} className="bg-white border rounded p-2 text-xs relative group">
                <div className="flex items-center gap-2 font-bold text-slate-700 mb-1">
                  <File size={12} className="text-blue-500" />
                  <span className="truncate flex-1">{doc.filename}</span>
                  <span className="text-slate-400 font-normal">{formatFileSize(doc.file_size)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span>{doc.chunks_count} {t('components.agentPanel.textChunks')}</span>
                  <span>·</span>
                  <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => handleDeleteDocument(doc.id)}
                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
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
            <span>{t('components.agentPanel.shortTermMemory')} ({agent.memory.length})</span>
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
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSimulationStore } from '../store';
import {
  X,
  BookOpen,
  Plus,
  FileText,
  Trash2,
  Upload,
  File,
  Loader2,
  Globe,
} from 'lucide-react';
import {
  addGlobalKnowledge,
  uploadGlobalDocument,
  listGlobalKnowledge,
  deleteGlobalKnowledge,
  GlobalKnowledgeItem,
} from '../services/simulations';

export const GlobalKnowledgePanel: React.FC = () => {
  const isOpen = useSimulationStore((s) => s.globalKnowledgeOpen);
  const setOpen = useSimulationStore((s) => s.setGlobalKnowledgeOpen);
  const simulationId = useSimulationStore((s) => s.currentSimulation?.id);

  const [items, setItems] = useState<GlobalKnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add text form state
  const [isAddingText, setIsAddingText] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load items when panel opens
  const loadItems = useCallback(async () => {
    if (!simulationId) return;
    setIsLoading(true);
    try {
      const data = await listGlobalKnowledge(simulationId);
      setItems(data);
    } catch (err) {
      console.error('Failed to load global knowledge:', err);
    } finally {
      setIsLoading(false);
    }
  }, [simulationId]);

  useEffect(() => {
    if (isOpen && simulationId) {
      loadItems();
    }
  }, [isOpen, simulationId, loadItems]);

  // Handle adding text
  const handleAddText = async () => {
    if (!simulationId || !newContent.trim()) return;
    setIsSavingText(true);
    try {
      await addGlobalKnowledge(simulationId, newContent, newTitle);
      setNewTitle('');
      setNewContent('');
      setIsAddingText(false);
      loadItems();
    } catch (err) {
      console.error('Failed to add global knowledge:', err);
    } finally {
      setIsSavingText(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!simulationId) {
      setUploadError('No simulation ID');
      return;
    }

    // Validate file type
    const allowedTypes = ['.pdf', '.txt', '.docx', '.md'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      setUploadError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Max size: 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      console.log(`INFO: Global document upload started - file=${file.name}`);
      const result = await uploadGlobalDocument(simulationId, file);
      console.log(`INFO: Global document upload complete - kw_id=${result.kw_id}, chunks=${result.chunks_count}`);
      loadItems();
    } catch (err: any) {
      console.error('ERROR: Global document upload failed -', err);
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async (kwId: string) => {
    if (!simulationId) return;
    try {
      await deleteGlobalKnowledge(simulationId, kwId);
      loadItems();
    } catch (err) {
      console.error('Failed to delete global knowledge:', err);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">全局知识库</h2>
              <p className="text-xs text-slate-500">所有代理共享的知识</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Document Upload Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Upload size={14} />
              上传文档
            </h3>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400'
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
                  <Loader2 size={20} className="animate-spin" />
                  <span>上传中...</span>
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600">拖放文件或点击上传</p>
                  <p className="text-xs text-slate-400 mt-1">
                    支持: PDF, TXT, DOCX, MD (最大 10MB)
                  </p>
                </>
              )}
            </div>
            {uploadError && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600">
                {uploadError}
              </div>
            )}
          </div>

          {/* Add Text Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText size={14} />
              添加文本知识
            </h3>
            {isAddingText ? (
              <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
                <input
                  type="text"
                  placeholder="标题（可选）"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  placeholder="知识内容..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddText}
                    disabled={isSavingText || !newContent.trim()}
                    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {isSavingText && <Loader2 size={14} className="animate-spin" />}
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingText(false);
                      setNewTitle('');
                      setNewContent('');
                    }}
                    className="flex-1 py-2 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingText(true)}
                className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-500 hover:text-blue-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} /> 添加文本知识
              </button>
            )}
          </div>

          {/* Knowledge Items List */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <BookOpen size={14} />
              知识列表 ({items.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-slate-400">
                <Loader2 size={24} className="mx-auto animate-spin mb-2" />
                <p className="text-sm">加载中...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm italic">
                暂无全局知识
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border rounded-lg p-3 relative group hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                        item.source_type === 'document'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {item.source_type === 'document' ? (
                          <File size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-800 truncate">
                          {item.title || item.filename || '未命名'}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {item.content_preview}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className={`px-1.5 py-0.5 rounded ${
                            item.source_type === 'document'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-green-50 text-green-600'
                          }`}>
                            {item.source_type === 'document' ? '文档' : '文本'}
                          </span>
                          {item.chunks_count > 0 && (
                            <span>{item.chunks_count} 个文本块</span>
                          )}
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
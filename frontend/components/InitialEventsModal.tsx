import React, { useState } from 'react';
import { useSimulationStore } from '../store';
import { X, Plus, Save, Image as ImageIcon, Music2, Video } from 'lucide-react';
import { MultimodalInput } from './MultimodalInput';

export const InitialEventsModal: React.FC = () => {
  const isOpen = useSimulationStore(s => (s as any).isInitialEventsOpen ?? false);
  const toggle = useSimulationStore(s => (s as any).toggleInitialEvents);
  const addInitialEvent = useSimulationStore(s => (s as any).addInitialEvent);
  const initialEvents = useSimulationStore(s => (s as any).initialEvents ?? []);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'audio' | 'video' | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setTitle('');
    setContent('');
    setMediaUrl(null);
    setMediaType(null);
  };

  const handleSave = () => {
    if (!title && !content && !mediaUrl) return;
    addInitialEvent(
      title || '初始事件',
      content,
      mediaType === 'image' ? mediaUrl || undefined : undefined,
      mediaType === 'audio' ? mediaUrl || undefined : undefined,
      mediaType === 'video' ? mediaUrl || undefined : undefined,
    );
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">初始事件编辑器</h3>
          <button onClick={() => { toggle(false); reset(); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          <div className="bg-white border rounded-lg p-3 space-y-3 shadow-sm">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="事件标题"
              className="w-full text-sm border rounded px-3 py-2 focus:ring-1 focus:ring-brand-500 outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="事件描述，可包含 markdown"
              className="w-full text-sm border rounded px-3 py-2 focus:ring-1 focus:ring-brand-500 outline-none min-h-[120px]"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="col-span-1">
                <MultimodalInput
                  label="图片 (可选)"
                  helperText="上传后自动插入 markdown 链接，可裁剪"
                  enableCrop
                  onInsert={(url) => { setMediaUrl(url); setMediaType('image'); setContent((p) => `${p}${p ? '\n' : ''}![image](${url})`); }}
                />
              </div>
              <div className="col-span-1 space-y-2">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Music2 size={14} /> 音频 URL</label>
                <input
                  type="url"
                  value={mediaType === 'audio' ? (mediaUrl || '') : ''}
                  onChange={(e) => { setMediaUrl(e.target.value); setMediaType('audio'); }}
                  placeholder="https://example.com/audio.mp3"
                  className="w-full text-sm border rounded px-3 py-2 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
              <div className="col-span-1 space-y-2">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Video size={14} /> 视频 URL</label>
                <input
                  type="url"
                  value={mediaType === 'video' ? (mediaUrl || '') : ''}
                  onChange={(e) => { setMediaUrl(e.target.value); setMediaType('video'); }}
                  placeholder="https://example.com/video.mp4"
                  className="w-full text-sm border rounded px-3 py-2 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-brand-600 text-white rounded flex items-center justify-center gap-2 text-sm"
              >
                <Save size={14} /> 保存并注入
              </button>
              <button
                onClick={reset}
                className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
              >重置</button>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-3 shadow-sm">
            <div className="text-xs font-bold text-slate-600 mb-2">已保存的初始事件</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {initialEvents.length === 0 && <div className="text-xs text-slate-400">暂无初始事件</div>}
              {initialEvents.map(ev => (
                <div key={ev.id} className="border rounded p-2 text-sm bg-slate-50">
                  <div className="font-bold text-slate-700">{ev.title}</div>
                  <div className="text-slate-600 whitespace-pre-line text-xs">{ev.content}</div>
                  <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-slate-500">
                    {ev.imageUrl && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded">
                        <ImageIcon size={12} /> 图片
                      </span>
                    )}
                    {ev.audioUrl && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded">
                        <Music2 size={12} /> 音频
                      </span>
                    )}
                    {ev.videoUrl && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded">
                        <Video size={12} /> 视频
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

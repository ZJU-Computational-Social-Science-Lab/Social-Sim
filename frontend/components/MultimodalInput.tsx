import React, { useState, useCallback, DragEvent, useId } from 'react';
import { uploadImage } from '../services/uploads';
import { Image as ImageIcon, Loader2, Upload as UploadIcon, X } from 'lucide-react';
import { useImageCrop, calculateCropOverlay, calculateCropPreviewStyle } from '../hooks/useImageCrop';

interface Props {
  label?: string;
  helperText?: string;
  onInsert: (url: string, altText?: string) => void;
  presetUrl?: string | null;
  enableCrop?: boolean;
  enableAltText?: boolean; // Enable alt text input for accessibility
}

const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const DOC_MAX_BYTES = 10 * 1024 * 1024;
const DOC_TYPES = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED = ['image/jpeg','image/png','image/gif','image/webp','audio/mpeg','audio/mp3','audio/wav','audio/ogg','video/mp4','video/webm',...DOC_TYPES];

export const MultimodalInput: React.FC<Props> = ({
  label,
  helperText,
  onInsert,
  presetUrl = null,
  enableCrop = true,
  enableAltText = true
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(presetUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'error' | 'success'; message: string }>({ kind: 'idle', message: '' });
  const [altText, setAltText] = useState('');
  const [progress, setProgress] = useState(0);
  const [lastUploadedName, setLastUploadedName] = useState<string>('');
  const inputId = useId();

  // Use the custom hook for cropping logic
  const {
    cropState,
    setCropState,
    isCropping,
    handleCrop,
    resetCrop,
  } = useImageCrop({
    onCropped: (url) => {
      setPreviewUrl(url);
      onInsert(url, altText || undefined);
      setStatus({ kind: 'success', message: '裁剪并上传成功' });
    },
    onError: (message) => {
      setStatus({ kind: 'error', message });
    },
  });

  const setError = (message: string) => setStatus({ kind: 'error', message });
  const setSuccess = (message: string) => setStatus({ kind: 'success', message });

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const isDoc = DOC_TYPES.includes(file.type);
    const limit = isDoc ? DOC_MAX_BYTES : MEDIA_MAX_BYTES;
    if (file.size > limit) {
      setError(isDoc ? '文档超过 10MB 限制' : '文件超过 5MB 限制');
      return;
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      setError('仅支持 JPG/PNG/GIF/WEBP/MP3/WAV/OGG/MP4/WEBM/PDF/DOC/DOCX');
      return;
    }
    setIsUploading(true);
    setProgress(0);
    setStatus({ kind: 'idle', message: '' });
    try {
      const asset = await uploadImage(file, { onProgress: setProgress });
      const isImage = file.type.startsWith('image/');
      setPreviewUrl(isImage ? asset.url : null);
      setLastUploadedName(file.name);
      onInsert(asset.url, altText || undefined);
      setSuccess('上传成功');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file ?? null);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  return (
    <div className="space-y-2">
      {label && <div className="text-xs font-bold text-slate-700">{label}</div>}
      <div
        className={`border-2 border-dashed rounded-lg p-3 bg-white flex flex-col items-center justify-center text-xs text-slate-500 cursor-pointer transition-colors ${isDragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <input
          id={inputId}
          type="file"
          className="hidden"
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {isUploading ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <Loader2 size={16} className="animate-spin" /> 上传中...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <UploadIcon size={18} className="text-slate-400" />
            <span>拖拽、粘贴或点击上传图片/音频/视频/文档</span>
          </div>
        )}
      </div>
      <div className="text-[11px] text-slate-400">
        {helperText || (enableCrop ? '支持拖拽/点击上传，提供方形或自由裁剪上传（仅图片）。' : '支持拖拽/点击上传。')}（图片/音频/视频 ≤ 5MB，PDF/Word ≤ 10MB，当前未做杀毒/内容安全，请只上传可信来源）
      </div>
      {status.kind !== 'idle' && (
        <div className={`text-[11px] ${status.kind === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
          {status.message}
        </div>
      )}
      {isUploading && (
        <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {enableAltText && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            图片描述（可选，用于无障碍访问）
          </label>
          <input
            type="text"
            className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="例如：一只坐在公园长椅上的橙色猫"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            maxLength={200}
          />
          <div className="text-[10px] text-slate-400">
            {altText.length}/200
          </div>
        </div>
      )}
      {previewUrl && (
        <div className="relative w-full border rounded bg-black/5 overflow-y-scroll overflow-x-hidden h-[320px] max-h-[60vh] pr-2">
          <img src={previewUrl} alt="preview" className="w-full max-h-48 object-contain" />
          {enableCrop && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
                style={{
                  width: `${calculateCropOverlay(cropState).width}%`,
                  height: `${calculateCropOverlay(cropState).height}%`,
                  left: `${calculateCropOverlay(cropState).left}%`,
                  top: `${calculateCropOverlay(cropState).top}%`
                }}
              />
            </div>
          )}
          <button
            onClick={() => {
              setPreviewUrl(null);
              setLastUploadedName('');
              setStatus({ kind: 'idle', message: '' });
              resetCrop();
            }}
            className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow text-slate-600 hover:text-red-500"
          >
            <X size={14} />
          </button>
          {enableCrop && (
            <div className="bg-white/90 backdrop-blur p-2 flex flex-wrap gap-3 items-center text-[11px] text-slate-700 sticky bottom-0">
              <label className="flex items-center gap-1">X 起点<input type="range" min="0" max="1" step="0.01" value={cropState.x} onChange={(e) => setCropState({ ...cropState, x: Number(e.target.value) })} /></label>
              <label className="flex items-center gap-1">Y 起点<input type="range" min="0" max="1" step="0.01" value={cropState.y} onChange={(e) => setCropState({ ...cropState, y: Number(e.target.value) })} /></label>
              <label className="flex items-center gap-1">模式
                <select
                  className="border rounded px-1 py-0.5 text-[11px]"
                  value={cropState.mode}
                  onChange={(e) => {
                    const mode = e.target.value as 'square' | 'free';
                    setCropState({ ...cropState, mode, scaleY: mode === 'square' ? cropState.scaleX : cropState.scaleY });
                  }}
                >
                  <option value="square">方形</option>
                  <option value="free">自由</option>
                </select>
              </label>
              <label className="flex items-center gap-1">宽缩放<input type="range" min="1" max="3" step="0.05" value={cropState.scaleX} onChange={(e) => {
                const val = Number(e.target.value);
                setCropState({ ...cropState, scaleX: val, scaleY: cropState.mode === 'square' ? val : cropState.scaleY });
              }} /></label>
              <label className="flex items-center gap-1">高缩放
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={cropState.scaleY}
                  disabled={cropState.mode === 'square'}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCropState({ ...cropState, scaleY: val, scaleX: cropState.mode === 'square' ? val : cropState.scaleX });
                  }}
                />
              </label>
              <div className="flex items-center gap-2 ml-auto">
                <div
                  className="w-16 h-16 rounded border overflow-hidden bg-white"
                  style={calculateCropPreviewStyle(previewUrl, cropState)}
                  title="裁剪预览"
                />
                <button
                  onClick={() => handleCrop(previewUrl)}
                  disabled={isUploading || isCropping}
                  className="px-2 py-1 bg-white border rounded text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {isCropping ? '裁剪中...' : '裁剪并重新上传'}
                </button>
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setLastUploadedName('');
                    setStatus({ kind: 'idle', message: '' });
                    resetCrop();
                  }}
                  className="px-2 py-1 border border-red-200 text-red-600 rounded text-[11px] hover:bg-red-50"
                >
                  删除图片
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {!previewUrl && lastUploadedName && status.kind === 'success' && (
        <div className="text-[11px] text-slate-600">已上传：{lastUploadedName}</div>
      )}
    </div>
  );
};

import React, { useState, useCallback, DragEvent, useId } from 'react';
import { uploadImage } from '../services/uploads';
import { Image as ImageIcon, Loader2, Upload as UploadIcon, X } from 'lucide-react';

interface Props {
  label?: string;
  helperText?: string;
  onInsert: (url: string) => void;
  presetUrl?: string | null;
  enableCrop?: boolean;
}

export const MultimodalInput: React.FC<Props> = ({ label, helperText, onInsert, presetUrl = null, enableCrop = true }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(presetUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'error' | 'success'; message: string }>({ kind: 'idle', message: '' });
  const [progress, setProgress] = useState(0);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [cropX, setCropX] = useState(0.5);
  const [cropY, setCropY] = useState(0.5);
  const [cropScale, setCropScale] = useState(1);
  const [lastUploadedName, setLastUploadedName] = useState<string>('');
  const inputId = useId();
  const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
  const DOC_MAX_BYTES = 10 * 1024 * 1024;
  const DOC_TYPES = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const ALLOWED = ['image/jpeg','image/png','image/gif','image/webp','audio/mpeg','audio/mp3','audio/wav','audio/ogg','video/mp4','video/webm',...DOC_TYPES];

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
      onInsert(asset.url);
      setCropUrl(null);
      setSuccess('上传成功');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropToSquare = async () => {
    if (!previewUrl) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = previewUrl;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const base = Math.min(img.naturalWidth, img.naturalHeight) / cropScale;
      const sx = Math.max(0, Math.min(img.naturalWidth - base, cropX * img.naturalWidth - base / 2));
      const sy = Math.max(0, Math.min(img.naturalHeight - base, cropY * img.naturalHeight - base / 2));
      const size = base;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'cropped.png', { type: 'image/png' });
          if (file.size > MAX_BYTES) {
            setError('裁剪后文件超过 5MB');
            return;
          }
          setIsUploading(true);
          setProgress(0);
          setStatus({ kind: 'idle', message: '' });
          try {
            const asset = await uploadImage(file, { onProgress: setProgress });
            setCropUrl(asset.url);
            setPreviewUrl(asset.url);
            onInsert(asset.url);
            setSuccess('裁剪并上传成功');
          } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : '裁剪上传失败');
          } finally {
            setIsUploading(false);
          }
        }, 'image/png');
      }
    } catch (err) {
      console.error(err);
      setError('裁剪失败');
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
        {helperText || (enableCrop ? '支持拖拽/点击上传，提供中心方形裁剪上传选项（仅图片）。' : '支持拖拽/点击上传。')}（图片/音频/视频 ≤ 5MB，PDF/Word ≤ 10MB，当前未做杀毒/内容安全，请只上传可信来源）
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
      {previewUrl && (
        <div className="relative w-full">
          <img src={previewUrl} alt="preview" className="w-full max-h-40 object-cover rounded border" />
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-2 right-2 bg-white/80 rounded-full p-1 shadow text-slate-600 hover:text-red-500"
          >
            <X size={14} />
          </button>
          {enableCrop && (
            <div className="absolute bottom-2 right-2 flex gap-2 flex-col items-end bg-white/80 p-2 rounded">
              <div className="flex gap-2 items-center text-[11px] text-slate-600">
                <span>X</span>
                <input type="range" min="0" max="1" step="0.01" value={cropX} onChange={(e) => setCropX(Number(e.target.value))} />
              </div>
              <div className="flex gap-2 items-center text-[11px] text-slate-600">
                <span>Y</span>
                <input type="range" min="0" max="1" step="0.01" value={cropY} onChange={(e) => setCropY(Number(e.target.value))} />
              </div>
              <div className="flex gap-2 items-center text-[11px] text-slate-600">
                <span>缩放</span>
                <input type="range" min="1" max="3" step="0.05" value={cropScale} onChange={(e) => setCropScale(Number(e.target.value))} />
              </div>
              <button
                onClick={handleCropToSquare}
                disabled={isUploading}
                className="px-2 py-1 bg-white/90 border rounded text-[11px] text-slate-700 hover:bg-white disabled:opacity-60"
              >
                方形裁剪并重新上传
              </button>
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

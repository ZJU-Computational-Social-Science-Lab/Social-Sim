import React from 'react';
import { useSimulationStore } from '../store';
import { X, DownloadCloud, Loader2 } from 'lucide-react';

export const SyncModal: React.FC = () => {
  const isOpen = useSimulationStore((s) => s.isSyncModalOpen);
  const close = useSimulationStore((s) => s.closeSyncModal);
  const sync = useSimulationStore((s) => s.syncCurrentSimulation);
  const logs = useSimulationStore((s) => s.syncLogs);
  const isSyncing = useSimulationStore((s) => s.isSyncing);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <DownloadCloud />
            <div className="font-bold">手动同步到后端</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => { if (!isSyncing) close(); }}>
              <X />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          <div className="text-sm text-slate-600 mb-3">同步日志：</div>
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            操作会将当前仿真覆盖保存到后端同名记录，不会再自动创建草稿，请确认后再执行。
          </div>
          <div className="bg-slate-100 rounded p-3 h-64 overflow-auto font-mono text-xs">
            {(logs && logs.length) ? (
              logs.map((l, i) => (
                <div key={i} className={l.startsWith('[ERROR]') ? 'text-red-600' : l.startsWith('[OK]') ? 'text-emerald-700' : 'text-slate-700'}>
                  {l}
                </div>
              ))
            ) : (
              <div className="text-slate-400">暂无日志，点击下方按钮开始同步。</div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            onClick={() => {
              try {
                const text = (logs || []).join('\n');
                navigator.clipboard.writeText(text || '');
                // small visual feedback
                alert('已复制同步日志到剪贴板');
              } catch (e) {
                alert('复制失败');
              }
            }}
            className="px-3 py-2 rounded border text-sm"
          >复制日志</button>
          <button
            onClick={() => {
              const content = (logs || []).join('\n');
              const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sync-log-${Date.now()}.txt`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-2 rounded border text-sm"
          >下载日志</button>
          <button
            onClick={() => {
              if (isSyncing) return;
              const ok = window.confirm('确认将当前仿真保存到后端？这会覆盖同名记录。');
              if (!ok) return;
              sync();
            }}
            className={`px-4 py-2 rounded text-sm font-medium ${isSyncing ? 'bg-slate-300 text-slate-700 cursor-wait' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> 同步中...</span>
            ) : (
              <span className="flex items-center gap-2"><DownloadCloud size={14} /> 开始同步</span>
            )}
          </button>
          <button onClick={() => { if (!isSyncing) close(); }} className="px-4 py-2 rounded border text-sm">关闭</button>
        </div>
      </div>
    </div>
  );
};

export default SyncModal;

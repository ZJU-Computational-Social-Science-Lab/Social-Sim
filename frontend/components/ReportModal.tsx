
import React, { useState } from 'react';
import { useSimulationStore } from '../store';
import { X, FileText, Sparkles, Loader2, Calendar, Lightbulb, Users, Target } from 'lucide-react';

export const ReportModal: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isReportModalOpen);
  const toggle = useSimulationStore(state => state.toggleReportModal);
  const currentSim = useSimulationStore(state => state.currentSimulation);
  const isGenerating = useSimulationStore(state => state.isGeneratingReport);
  const generateReport = useSimulationStore(state => state.generateReport);
   const [lightbox, setLightbox] = useState<string | null>(null);

  if (!isOpen || !currentSim) return null;
  const report = currentSim.report;
   const logs = useSimulationStore(state => state.logs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              <FileText className="text-indigo-600" size={20} />
              仿真实验分析报告 (Automated Analysis)
            </h2>
            <p className="text-xs text-indigo-600 mt-1">
               {report ? `生成于: ${new Date(report.generatedAt).toLocaleString()}` : '暂无报告'}
            </p>
          </div>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
           {!report ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
                 <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
                    <Sparkles size={40} className="text-indigo-300" />
                 </div>
                 <div className="text-center max-w-sm">
                    <h3 className="text-lg font-bold text-slate-700 mb-2">生成智能分析报告</h3>
                    <p className="text-sm">系统将读取当前实验的日志记录与智能体历史状态，使用大模型生成包含摘要、关键转折、行为分析与改进建议的完整报告。</p>
                 </div>
                 <button 
                   onClick={generateReport}
                   disabled={isGenerating}
                   className="px-8 py-3 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all font-bold flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                 >
                    {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                    {isGenerating ? '正在分析数据...' : '立即生成报告'}
                 </button>
              </div>
           ) : (
              <div className="max-w-4xl mx-auto space-y-8">
                 {/* Summary Section */}
                 <section className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-2 text-indigo-700 mb-4 pb-2 border-b">
                       <Target size={20} />
                       <h3 className="font-bold text-lg">实验摘要 (Executive Summary)</h3>
                    </div>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                       {report.summary}
                    </p>
                 </section>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Key Events */}
                    <section className="bg-white rounded-xl shadow-sm border p-6">
                       <div className="flex items-center gap-2 text-amber-600 mb-4 pb-2 border-b">
                          <Calendar size={20} />
                          <h3 className="font-bold text-lg">关键转折点 (Key Events)</h3>
                       </div>
                       <ul className="space-y-4">
                          {report.keyEvents.map((event, i) => (
                             <li key={i} className="flex gap-3">
                                <span className="flex-shrink-0 w-12 text-xs font-bold bg-amber-50 text-amber-700 h-6 flex items-center justify-center rounded">
                                   R{event.round}
                                </span>
                                <p className="text-sm text-slate-700">{event.description}</p>
                             </li>
                          ))}
                       </ul>
                    </section>

                    {/* Suggestions */}
                    <section className="bg-white rounded-xl shadow-sm border p-6">
                       <div className="flex items-center gap-2 text-emerald-600 mb-4 pb-2 border-b">
                          <Lightbulb size={20} />
                          <h3 className="font-bold text-lg">后续建议 (Suggestions)</h3>
                       </div>
                       <ul className="space-y-2">
                          {report.suggestions.map((s, i) => (
                             <li key={i} className="text-sm text-slate-700 flex gap-2 items-start">
                                <span className="text-emerald-500 mt-1">•</span>
                                {s}
                             </li>
                          ))}
                       </ul>
                    </section>
                 </div>

                 {/* Agent Analysis */}
                 <section className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-2 text-blue-600 mb-4 pb-2 border-b">
                       <Users size={20} />
                       <h3 className="font-bold text-lg">智能体行为分析 (Agent Analysis)</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                       {report.agentAnalysis.map((item, i) => (
                          <div key={i} className="bg-slate-50 rounded-lg p-4 border">
                             <h4 className="font-bold text-slate-800 mb-2">{item.agentName}</h4>
                             <p className="text-sm text-slate-600">{item.analysis}</p>
                          </div>
                       ))}
                    </div>
                 </section>

                         {/* Thumbnails from logs */}
                         <section className="bg-white rounded-xl shadow-sm border p-6">
                              <div className="flex items-center gap-2 text-slate-600 mb-4 pb-2 border-b">
                                  <FileText size={18} />
                                  <h3 className="font-bold text-lg">多模态日志缩略图</h3>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                 {logs.filter(l => l.imageUrl).slice(-12).map((l) => (
                                    <div key={l.id} className="bg-slate-50 border rounded p-2">
                                       <img src={l.imageUrl} alt="thumb" className="w-full h-24 object-cover rounded cursor-pointer" onClick={() => setLightbox(l.imageUrl!)} />
                                       <p className="text-[11px] text-slate-500 mt-1 truncate">{l.content}</p>
                                    </div>
                                 ))}
                                 {logs.filter(l => l.imageUrl).length === 0 && (
                                    <p className="text-xs text-slate-400 col-span-full">暂无图片日志</p>
                                 )}
                              </div>
                         </section>
              </div>
           )}
        </div>
        
        {report && (
          <div className="px-6 py-4 border-t bg-white flex justify-end gap-3 shrink-0">
             <button 
                onClick={generateReport}
                disabled={isGenerating}
                className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
             >
                <Sparkles size={16} /> 重新生成
             </button>
             <button onClick={() => toggle(false)} className="px-6 py-2 text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg shadow-sm">
                关闭
             </button>
          </div>
        )}

            {lightbox && (
               <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                  <img src={lightbox} alt="full" className="max-w-full max-h-full rounded shadow-2xl" />
                  <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}>
                     <X size={28} />
                  </button>
               </div>
            )}
      </div>
    </div>
  );
};
